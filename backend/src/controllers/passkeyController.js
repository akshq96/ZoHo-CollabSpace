const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const User = require('../models/User');
const response = require('../utils/responseHandler');

// RP (Relying Party) config. In production this MUST match the exact
// hostname the frontend is served from — WebAuthn ties credentials to the
// origin/rpID for phishing resistance. Configurable via env for deployment;
// defaults are dev-friendly (Create React App on localhost).
const RP_NAME = 'ZoHo Web';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';

// Anonymous (pre-login) authentication challenges can't be stored on a user
// document since we don't know who's authenticating yet. This in-memory
// store is fine for a single backend instance; a multi-instance deployment
// would need Redis or similar instead.
const anonChallenges = new Map(); // challenge -> expiresAt
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
function rememberAnonChallenge(challenge) {
    anonChallenges.set(challenge, Date.now() + CHALLENGE_TTL_MS);
}
function consumeAnonChallenge(challenge) {
    const expires = anonChallenges.get(challenge);
    anonChallenges.delete(challenge);
    return !!expires && expires > Date.now();
}
setInterval(() => {
    const now = Date.now();
    for (const [c, exp] of anonChallenges) if (exp < now) anonChallenges.delete(c);
}, 60 * 1000).unref?.();

// ---- Registration: adding a passkey to an already-logged-in account ----

const registerOptions = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return response(res, 404, 'User not found');

        const options = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID: RP_ID,
            userID: Buffer.from(user._id.toString()),
            userName: user.username || user.email || user.phoneNumber || 'zoho-user',
            attestationType: 'none',
            excludeCredentials: (user.passkeys || []).map((pk) => ({
                id: pk.credentialID,
                transports: pk.transports,
            })),
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
            },
        });

        user.currentChallenge = options.challenge;
        await user.save();

        return response(res, 200, 'Registration options generated', options);
    } catch (error) {
        console.error('Error in passkey registerOptions:', error);
        return response(res, 500, 'Unable to start passkey registration');
    }
};

const registerVerify = async (req, res) => {
    try {
        const { credential, label } = req.body;
        const user = await User.findById(req.user._id);
        if (!user) return response(res, 404, 'User not found');
        if (!user.currentChallenge) return response(res, 400, 'No pending passkey registration for this account');

        const verification = await verifyRegistrationResponse({
            response: credential,
            expectedChallenge: user.currentChallenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
        });

        user.currentChallenge = undefined;

        if (!verification.verified || !verification.registrationInfo) {
            await user.save();
            return response(res, 400, 'Passkey registration could not be verified');
        }

        const { credential: registeredCredential } = verification.registrationInfo;
        user.passkeys.push({
            credentialID: registeredCredential.id,
            publicKey: Buffer.from(registeredCredential.publicKey).toString('base64url'),
            counter: registeredCredential.counter,
            transports: credential.response?.transports || [],
            label: (label || 'Passkey').slice(0, 40),
        });
        await user.save();

        return response(res, 201, 'Passkey added', { label: label || 'Passkey' });
    } catch (error) {
        console.error('Error in passkey registerVerify:', error);
        return response(res, 500, 'Unable to verify passkey registration');
    }
};

const listPasskeys = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('passkeys');
        if (!user) return response(res, 404, 'User not found');
        const list = (user.passkeys || []).map((pk) => ({
            _id: pk._id,
            label: pk.label,
            createdAt: pk.createdAt,
        }));
        return response(res, 200, 'Passkeys retrieved', list);
    } catch (error) {
        console.error('Error in listPasskeys:', error);
        return response(res, 500, 'Unable to load passkeys');
    }
};

const removePasskey = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(req.user._id);
        if (!user) return response(res, 404, 'User not found');
        user.passkeys = (user.passkeys || []).filter((pk) => pk._id.toString() !== id);
        await user.save();
        return response(res, 200, 'Passkey removed');
    } catch (error) {
        console.error('Error in removePasskey:', error);
        return response(res, 500, 'Unable to remove passkey');
    }
};

// ---- Authentication: signing in with a passkey (no prior identifier) ----

const loginOptions = async (req, res) => {
    try {
        const options = await generateAuthenticationOptions({
            rpID: RP_ID,
            userVerification: 'preferred',
            // No allowCredentials — this is a "usernameless"/discoverable flow;
            // the browser prompts with whichever passkeys it has for this RP,
            // and we identify the account server-side by the credential ID
            // returned in the assertion (see loginVerify).
        });
        rememberAnonChallenge(options.challenge);
        return response(res, 200, 'Authentication options generated', options);
    } catch (error) {
        console.error('Error in passkey loginOptions:', error);
        return response(res, 500, 'Unable to start passkey sign-in');
    }
};

const loginVerify = async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential || !credential.id) return response(res, 400, 'Malformed passkey response');

        const clientDataJSON = JSON.parse(Buffer.from(credential.response.clientDataJSON, 'base64url').toString('utf8'));
        const challenge = clientDataJSON.challenge;
        if (!consumeAnonChallenge(challenge)) {
            return response(res, 400, 'This passkey sign-in request expired. Please try again.');
        }

        const user = await User.findOne({ 'passkeys.credentialID': credential.id });
        if (!user) return response(res, 404, "This passkey isn't registered to any ZoHo Web account.");

        const authenticator = user.passkeys.find((pk) => pk.credentialID === credential.id);

        const verification = await verifyAuthenticationResponse({
            response: credential,
            expectedChallenge: challenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
            credential: {
                id: authenticator.credentialID,
                publicKey: Buffer.from(authenticator.publicKey, 'base64url'),
                counter: authenticator.counter,
                transports: authenticator.transports,
            },
        });

        if (!verification.verified) {
            return response(res, 401, 'Passkey verification failed');
        }

        authenticator.counter = verification.authenticationInfo.newCounter;
        await user.save();

        const token = user.generateToken();
        return response(res, 200, 'Signed in with passkey', { user, token });
    } catch (error) {
        console.error('Error in passkey loginVerify:', error);
        return response(res, 500, 'Unable to verify passkey sign-in');
    }
};

module.exports = { registerOptions, registerVerify, listPasskeys, removePasskey, loginOptions, loginVerify };
