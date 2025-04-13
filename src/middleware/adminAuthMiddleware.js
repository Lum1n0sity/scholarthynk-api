const User = require('../models/User');
const logger = require('../config/logger');

const adminAuthMiddleware = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({error: "You are not authorized to perform this action!"});
        }

        const user = await User.findOne({userId: req.user});
        if (!user) return res.status(404).json({error: "User doesn't exists!"});

        if (user.role !== 'admin') {
            return res.status(401).json({error: "You are not authorized to perform this action!"});
        }

        next();
    } catch (err) {
        logger.fatal(err);
        return res.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

module.exports = adminAuthMiddleware;