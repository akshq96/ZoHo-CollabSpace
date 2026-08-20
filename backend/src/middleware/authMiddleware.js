const jwt = require('jsonwebtoken');
const User = require('../models/User');
const response = require('../utils/responseHandler');

const protectRoute = async (req, res, next) => {
    try {
        let token;
        
        // 1. Check for token in cookies
        if (req.cookies && req.cookies.auth_token) {
            token = req.cookies.auth_token;
        } 
        // 2. Check for token in Authorization header
        else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return response(res, 401, "Not authorized, no token provided");
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find user and attach to request
        const user = await User.findById(decoded.id).select("-emailOtp -emailOtpExpiry");
        if (!user) {
            return response(res, 404, "User not found");
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("Error in authMiddleware:", error.message);
        return response(res, 401, "Not authorized, token failed");
    }
};

module.exports = protectRoute;
