const User = require("../models/User");
const { sendOtpToEmail } = require("../services/emailService");
const { otpGenerater } = require("../utils/otpGenerator");
const response = require('../utils/responseHandler');
const twilioService = require("../services/twilioService");
const cloudinary = require('../config/cloudinaryConfig');
const { saveBuffer } = require('../services/storageService');
const { normalizePhone } = require('../utils/phoneUtils');

const OTP_COOLDOWN_MS = 30 * 1000; // matches the 30s "Resend code" countdown in the UI
const cloudinaryConfigured = () =>
    !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

// Twilio Verify error codes we can translate into a message a user can
// actually act on, instead of a generic "Internal Server Error". See
// https://www.twilio.com/docs/api/errors for the full list.
function describeTwilioError(error) {
    const code = error && error.code;
    if (code === 60200) return "That phone number doesn't look valid. Double-check the country code and number.";
    if (code === 60203) return "Too many attempts for this number. Please wait a few minutes and try again.";
    if (code === 60212) return "Too many verification attempts. Please wait before requesting a new code.";
    if (code === 20404 || code === 60202) return "That verification code is invalid or has expired.";
    if (code === 21211 || code === 21614) return "That phone number is not a valid, reachable mobile number.";
    if (code === 21608) return "This Twilio account is in trial mode, which only allows sending to phone numbers you've manually verified in the Twilio console. Verify this number there, or upgrade the account, to send it real SMS.";
    if (code === 60410 || code === 60422) return "SMS delivery to this country/carrier isn't enabled on this Twilio Verify Service. Check Verify > Services > Settings > enabled channels/geo permissions in the Twilio console.";
    if (code === 20003) return "Twilio rejected the request due to invalid credentials (Account SID / Auth Token). Check your .env values.";
    return "We couldn't reach the SMS provider. Please check the phone number and try again.";
}

// In development, a developer debugging "it works for one number but not
// another" needs the ACTUAL provider reason, not just a generic message —
// per the explicit requirement to never hide this behind "Something went
// wrong". Never includes the OTP itself, credentials, or API keys — only
// the already-public Twilio error code/message and the normalized number
// (which the developer just typed in themselves).
function describeTwilioErrorForResponse(error, normalizedE164) {
    const friendly = describeTwilioError(error);
    if (process.env.NODE_ENV === 'production') return friendly;
    const code = error && error.code;
    const raw = error && error.message;
    return `${friendly} [dev debug — number: ${normalizedE164 || 'n/a'}, Twilio code: ${code || 'n/a'}, reason: ${raw || 'n/a'}]`;
}

//         SEND OTP CONTROLLER

const sendOtp = async (req, res) => {
    const { phoneNumber, phoneSuffix, email } = req.body;
    const otp = otpGenerater();
    const expiry = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

    try {
        let user;

        //  EMAIL OTP FLOW
        if (email) {
            user = await User.findOne({ email });
            if (!user) user = new User({ email });

            if (user.lastOtpSentAt && Date.now() - new Date(user.lastOtpSentAt).getTime() < OTP_COOLDOWN_MS) {
                const waitSec = Math.ceil((OTP_COOLDOWN_MS - (Date.now() - new Date(user.lastOtpSentAt).getTime())) / 1000);
                return response(res, 429, `Please wait ${waitSec}s before requesting another code.`);
            }

            user.emailOtp = otp;
            user.emailOtpExpiry = expiry;
            user.lastOtpSentAt = new Date();
            await user.save();

            try {
                await sendOtpToEmail(email, otp);
            } catch (emailErr) {
                console.error("Error sending OTP email:", emailErr);
                return response(res, 502, "We couldn't send the OTP email. Please check the address and try again.");
            }

            return response(res, 200, "OTP sent to email", { email });
        }

        //  PHONE OTP FLOW
        if (!phoneNumber || !phoneSuffix) {
            return response(res, 400, "Phone number and phone suffix are required");
        }

        const normalized = normalizePhone(phoneSuffix, phoneNumber);
        if (!normalized) {
            return response(res, 400, "That phone number doesn't look valid. Include a country code and 6-14 digit number.");
        }

        user = await User.findOne({ phoneSuffix: normalized.suffix, phoneNumber: normalized.number });
        if (!user) user = new User({ phoneNumber: normalized.number, phoneSuffix: normalized.suffix });

        if (user.lastOtpSentAt && Date.now() - new Date(user.lastOtpSentAt).getTime() < OTP_COOLDOWN_MS) {
            const waitSec = Math.ceil((OTP_COOLDOWN_MS - (Date.now() - new Date(user.lastOtpSentAt).getTime())) / 1000);
            return response(res, 429, `Please wait ${waitSec}s before requesting another code.`);
        }

        try {
            await twilioService.sendOtpViaTwilio(normalized.e164);
        } catch (twilioErr) {
            // Provider status/code/message are already logged in twilioService
            // itself (never the OTP, credentials, or secrets) — this just adds
            // the normalized number for correlation.
            console.error(`Error sending OTP via Twilio for ${normalized.e164}:`, { code: twilioErr.code, status: twilioErr.status, message: twilioErr.message });
            return response(res, 502, describeTwilioErrorForResponse(twilioErr, normalized.e164));
        }

        user.lastOtpSentAt = new Date();
        await user.save();

        return response(res, 200, "OTP sent to phone number", { phoneNumber: normalized.number, phoneSuffix: normalized.suffix });
    } catch (error) {
        console.error("Error in sendOtp:", error);
        return response(res, 500, "Internal Server Error");
    }
};

//        VERIFY OTP CONTROLLER
const verifyOtp = async (req, res) => {
    const { phoneNumber, phoneSuffix, email, otp } = req.body;

    if (!otp) {
        return response(res, 400, "Verification code is required");
    }

    try {
        let user;

        //  EMAIL OTP VERIFY FLOW
        if (email) {
            user = await User.findOne({ email });

            if (!user) return response(res, 404, "User not found with this email");

            const now = new Date();

            if (!user.emailOtp || !user.emailOtpExpiry) {
                return response(res, 400, "Request a new code first.");
            }
            if (now > new Date(user.emailOtpExpiry)) {
                return response(res, 400, "That code has expired. Please request a new one.");
            }
            if (String(user.emailOtp) !== String(otp)) {
                return response(res, 400, "That code is incorrect. Please try again.");
            }

            user.isVerified = true;
            user.emailOtp = null;
            user.emailOtpExpiry = null;
            await user.save();
        }

        //  PHONE OTP VERIFY FLOW
        else {
            if (!phoneNumber || !phoneSuffix)
                return response(res, 400, "Phone number and phone suffix are required");

            const normalized = normalizePhone(phoneSuffix, phoneNumber);
            if (!normalized) {
                return response(res, 400, "That phone number doesn't look valid.");
            }

            user = await User.findOne({ phoneSuffix: normalized.suffix, phoneNumber: normalized.number });

            if (!user)
                return response(res, 404, "User not found with this phone number. Request a code first.");

            let result;
            try {
                result = await twilioService.verifyOtp(normalized.e164, otp);
            } catch (twilioErr) {
                console.error(`Error verifying OTP via Twilio for ${normalized.e164}:`, { code: twilioErr.code, status: twilioErr.status, message: twilioErr.message });
                return response(res, 400, describeTwilioErrorForResponse(twilioErr, normalized.e164));
            }

            if (result.status !== "approved") {
                return response(res, 400, "That code is incorrect or has expired. Please try again.");
            }

            user.isVerified = true;
            await user.save();
        }

        // TOKEN GENERATE & COOKIE SET
        const token = user.generateToken(user._id);
        res.cookie("auth_token", token, {
            httpOnly: true,
            maxAge: 86400 * 1000, // 24 hrs
        });

        return response(res, 200, "OTP verified successfully", { user, token });
    } catch (error) {
        console.error("Error in verifyOtp:", error);
        return response(res, 500, "Internal Server Error");
    }
};

const updateProfile = async (req, res) => {
    const { username, agreedToTerms, about, statusPrivacy, notifyMessages, notifyStatus, notifyFiles } = req.body;
    const userId = req.user._id || req.user.id;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return response(res, 404, "User not found");
        }

        let profilePictureUrl = user.profilePicture;
        if (req.file) {
            // The uploaded avatar must be the exact file the user picked —
            // never a generated placeholder. Cloudinary if configured,
            // otherwise local disk storage (see storageService.js).
            if (cloudinaryConfigured()) {
                const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
                const uploadResult = await cloudinary.uploader.upload(fileStr, {
                    folder: 'profile_pictures',
                    width: 300,
                    crop: "scale"
                });
                profilePictureUrl = uploadResult.secure_url;
            } else {
                const saved = saveBuffer(req.file.buffer, req.file.originalname, req.file.mimetype, 'avatars');
                profilePictureUrl = saved.url;
            }
        }

        // Update fields
        if (username !== undefined) user.username = username;
        if (about !== undefined) user.about = about;
        if (agreedToTerms !== undefined) {
            user.agreedToTerms = agreedToTerms === 'true' || agreedToTerms === true;
        }
        if (statusPrivacy !== undefined && ['everyone', 'contacts'].includes(statusPrivacy)) {
            user.statusPrivacy = statusPrivacy;
        }
        if (notifyMessages !== undefined) user.notifyMessages = notifyMessages === 'true' || notifyMessages === true;
        if (notifyStatus !== undefined) user.notifyStatus = notifyStatus === 'true' || notifyStatus === true;
        if (notifyFiles !== undefined) user.notifyFiles = notifyFiles === 'true' || notifyFiles === true;
        if (req.file) {
            user.profilePicture = profilePictureUrl;
        }

        await user.save();
        return response(res, 200, "Profile updated successfully", user);
    } catch (error) {
        console.error("Error in updateProfile:", error);
        return response(res, 500, "Internal Server Error");
    }
};

const checkAuth = async (req, res) => {
    try {
        return response(res, 200, "User authenticated successfully", req.user);
    } catch (error) {
        console.error("Error in checkAuth:", error);
        return response(res, 500, "Internal Server Error");
    }
};

// Export controllers
module.exports = { sendOtp, verifyOtp, checkAuth, updateProfile };
