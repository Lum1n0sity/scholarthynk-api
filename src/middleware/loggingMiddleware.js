const logger = require('../config/logger');

/**
 * Express middleware that logs incoming requests using pino.
 * @param {IncomingMessage} req - The request object.
 * @param {ServerResponse} res - The response object.
 * @param {Function} next - The next middleware in the stack.
 */
const loggingMiddleware = (req, res, next) => {
    if (req.url )
    logger.info({method: req.method, url: /^\/[^\/]+$/.test(req.url) ? `/api/user${req.url}` : req.url, user: req.user || "guest"}, "Incoming request");
    next();
};

module.exports = loggingMiddleware;