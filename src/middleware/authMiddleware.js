const jwt = require("jsonwebtoken");

require('dotenv').config();

/**
 * Express middleware that checks if the request has a valid authorization token.
 * If the token is valid, it adds the user ID to the request object and calls the next middleware.
 * If the token is invalid or missing, it returns a 401 Unauthorized response.
 * @param {IncomingMessage} req - The request object.
 * @param {ServerResponse} res - The response object.
 * @param {Function} next - The next middleware in the stack.
 */
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({success: false, error: 'Unable to authorize!'});

    const payload = verifyAuthToken(token);
    if (!payload) return res.status(401).json({success: false, error: 'Unable to authorize!'});

    req.user = payload.userId;
    next();
};


/**
 * Verifies a given authorization token and returns the payload if valid.
 * If the token is invalid, it returns null.
 * @param {string} token - The authorization token to verify.
 * @returns {Object|null} The payload of the token if it is valid, null otherwise.
 */
function verifyAuthToken(token) {
    try {
        return jwt.verify(token, process.env.SECRET_KEY);
    } catch (error) {
        return null;
    }
}

module.exports = authMiddleware;