// const mongoose = require('mongoose');

// // ye yahan pe use kiya gya hai for unique identification.
// const userSchema = new mongoose.Schema({
//     phoneNumber: { type: String, unique: true , sparse: true},

//     // phonenumber unique ho isiliye OTP verificaton.
//     phoneSuffix: { type: String, unique: false},  
//     username:{type: String},

//     // email verifcation ke liye with Otp.
//     email:{
//         type: String,
//         lowercase: true,
//         validate: {
//             validator: function(value) {
//             return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
//         },
//         message: "Invalid email format",
//     },
// },
// // This field is for OTP verification of email
// // and various feature as you can see below.
// emailOtp: { type: String },
// emailOtpExpiry: { type: Date },
// profilePicture: { type: String },
// about: { type: String },
// lastSeen: { type: Date },
// isOnline: { type: Boolean, default: false },
// isVerified: { type: Boolean, default: false },
// agreedToTerms: { type: Boolean, default: false },
// }, { timestamps: true });

// const User = mongoose.model('User', userSchema);
// module.exports = User; 

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');   // ⭐ needed for token

// Schema
const userSchema = new mongoose.Schema({
    // NOTE: phoneNumber alone is NOT unique — two different countries can
    // share the same local digits (e.g. +91 9876543210 vs +1 9876543210).
    // Uniqueness is enforced on the (phoneSuffix, phoneNumber) pair below via
    // a compound index instead. Both fields are stored normalized (see
    // src/utils/phoneUtils.js): phoneSuffix like "+91", phoneNumber digits only.
    phoneNumber: { type: String },
    phoneSuffix: { type: String },
    username: { type: String },

    email: {
        type: String,
        lowercase: true,
        validate: {
            validator: function (value) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            },
            message: "Invalid email format",
        },
    },

    emailOtp: { type: String },
    emailOtpExpiry: { type: Date },

    // Cooldown guard shared by both email + phone OTP so a user (or a script)
    // can't hammer the "send OTP" endpoint — see authController.sendOtp.
    lastOtpSentAt: { type: Date },

    profilePicture: { type: String },
    about: { type: String },
    lastSeen: { type: Date },
    isOnline: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    agreedToTerms: { type: Boolean, default: false },

    // ---- Privacy ----
    // Who can see this user's status stories. 'contacts' now means "accepted
    // connections" (see Connection model) — there's no separate messaging
    // privacy setting anymore because messaging permission is ALWAYS gated
    // by an accepted connection (see conversationController/canMessage),
    // not something a user can opt out of.
    statusPrivacy: { type: String, enum: ['everyone', 'contacts'], default: 'contacts' },

    // ---- Notification preferences ----
    notifyMessages: { type: Boolean, default: true },
    notifyStatus: { type: Boolean, default: true },
    notifyFiles: { type: Boolean, default: true },

    // ---- Passkeys (WebAuthn) ----
    // Only the PUBLIC key + credential metadata are ever stored server-side —
    // the private key never leaves the user's authenticator/device. counter
    // is the signature counter used to detect cloned authenticators.
    passkeys: [{
        credentialID: { type: String, required: true }, // base64url
        publicKey: { type: String, required: true }, // base64url-encoded COSE public key
        counter: { type: Number, default: 0 },
        transports: [{ type: String }],
        label: { type: String, default: 'Passkey' },
        createdAt: { type: Date, default: Date.now },
    }],
    // Short-lived WebAuthn challenge, cleared immediately after use. Stored
    // per-user rather than in a session store since auth here is JWT-based.
    currentChallenge: { type: String },

}, { timestamps: true });

// Compound uniqueness: the same (country code, local number) pair can only
// belong to one account, but the same local digits under different country
// codes are legitimately different people.
userSchema.index({ phoneSuffix: 1, phoneNumber: 1 }, { unique: true, sparse: true });


// ⭐ ADD THIS — JWT Token generator method
userSchema.methods.generateToken = function () {
    return jwt.sign(
        { id: this._id },
        process.env.JWT_SECRET,  // must be set in .env
        { expiresIn: "7d" }
    );
};


// Export model
const User = mongoose.model('User', userSchema);
module.exports = User;
