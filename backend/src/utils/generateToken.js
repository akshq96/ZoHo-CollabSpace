const jwt = require('jsonwebtoken');

const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: '1y', // Token 1 year ke liye valid rahega
    })
}
module.exports = generateToken;