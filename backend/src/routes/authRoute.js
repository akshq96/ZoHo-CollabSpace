const express = require('express');
const authController = require('../controllers/authController');
const passkeyController = require('../controllers/passkeyController');
const protectRoute = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);
router.get('/check-auth', protectRoute, authController.checkAuth);
router.put('/update-profile', protectRoute, upload.single('profilePicture'), authController.updateProfile);

// Passkeys (WebAuthn) — registration requires an existing session (you're
// adding a passkey to your account); login is anonymous/discoverable since
// there's no account yet to attach the request to.
router.post('/passkeys/register-options', protectRoute, passkeyController.registerOptions);
router.post('/passkeys/register-verify', protectRoute, passkeyController.registerVerify);
router.get('/passkeys', protectRoute, passkeyController.listPasskeys);
router.delete('/passkeys/:id', protectRoute, passkeyController.removePasskey);
router.post('/passkeys/login-options', passkeyController.loginOptions);
router.post('/passkeys/login-verify', passkeyController.loginVerify);

module.exports = router;



