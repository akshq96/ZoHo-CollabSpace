// const twillo = require('twilio');

// // Twilio configuration

// const accountSid = process.env.TWILIO_ACCOUNT_SID;
// const authToken = process.env.TWILIO_AUTH_TOKEN;
// const serviceSid = process.env.TWILIO_SERVICE_SID;

// const client = twillo(accountSid, authToken);

// // Function to send OTP via Twilio
// const sendOtpViaTwilio = async (phoneNumber) => {
//     try {
//         console.log("Sending OTP to:", phoneNumber);
//         if (!phoneNumber) {
//             throw new Error("Phone number is required to send OTP");
//         }
//         const response = await client.verify.v2.services(serviceSid)
//             .verifications
//             .create({ to: phoneNumber, channel: 'sms' });
//         console.log("Twilio response:", response);
//         return response;
//     } catch (error) {
//         console.error( error);
//         throw new Error("Failed to send OTP");
//     }
// }
// // Function to verify OTP via Twilio
// const verifyOtp = async (phoneNumber,otp) => {
//     try {
//         console.log("this is otp", otp);
//         console.log("Verifying OTP for:", phoneNumber);
//         const response = await client.verify.v2.services(serviceSid)
//             .verificationChecks
//             .create({ to: phoneNumber, code: otp });
//         console.log("otp response:", response);
//         return response;
//     } catch (error) {
//         console.error( error);
//         throw new Error("otp verification failed");
//     }
// };
// module.exports = {
//     sendOtpViaTwilio,
//     verifyOtp
// };

require("dotenv").config();
const twilio = require("twilio");

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// The single most common cause of "phone OTP just doesn't work": a Verify
// Service SID must start with "VA". Pasting the Account SID (starts "AC") or
// a Messaging Service SID (starts "MG") into TWILIO_SERVICE_SID compiles
// fine and fails at request time with an opaque 404/20404 from Twilio. Warn
// loudly at startup instead of letting that surface as a mystery OTP bug.
function warnIfMisconfigured() {
    const sid = process.env.TWILIO_ACCOUNT_SID || '';
    const serviceSid = process.env.TWILIO_SERVICE_SID || '';
    const authToken = process.env.TWILIO_AUTH_TOKEN || '';
    const problems = [];
    if (!sid || !serviceSid || !authToken) problems.push('One or more of TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_SERVICE_SID is missing from .env.');
    if (sid && !sid.startsWith('AC')) problems.push(`TWILIO_ACCOUNT_SID should start with "AC" — got "${sid.slice(0, 4)}...". Check you copied the Account SID, not something else.`);
    if (serviceSid && !serviceSid.startsWith('VA')) problems.push(`TWILIO_SERVICE_SID should start with "VA" (a Verify Service SID, created under Verify > Services in the Twilio console) — got "${serviceSid.slice(0, 4)}...". A Messaging Service SID ("MG...") or Account SID here will make every OTP send fail.`);
    if (problems.length) {
        console.warn('\n[twilioService] Phone OTP configuration warning(s):');
        problems.forEach((p) => console.warn('  - ' + p));
        console.warn('  Phone OTP requests will likely fail until this is corrected.\n');
    }
}
warnIfMisconfigured();

const sendOtpViaTwilio = async (phoneNumber) => {
    try {
        const result = await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
            .verifications.create({ to: phoneNumber, channel: "sms" });
        console.log(`[twilioService] OTP send requested for ${phoneNumber} — Twilio status: ${result.status}`);
        return result;
    } catch (error) {
        // Log the RAW provider error server-side (code, message, moreInfo) so
        // the actual cause is visible in server logs instead of being
        // swallowed — authController still translates this into a safe,
        // user-facing message via describeTwilioError.
        console.error(`[twilioService] Twilio send FAILED for ${phoneNumber}: code=${error.code} status=${error.status} message="${error.message}" moreInfo=${error.moreInfo || 'n/a'}`);
        throw error;
    }
};

const verifyOtp = async (phoneNumber, otp) => {
    try {
        const result = await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
            .verificationChecks.create({ to: phoneNumber, code: otp });
        console.log(`[twilioService] OTP verify for ${phoneNumber} — Twilio status: ${result.status}`);
        return result;
    } catch (error) {
        console.error(`[twilioService] Twilio verify FAILED for ${phoneNumber}: code=${error.code} status=${error.status} message="${error.message}" moreInfo=${error.moreInfo || 'n/a'}`);
        throw error;
    }
};

module.exports = { sendOtpViaTwilio, verifyOtp };

