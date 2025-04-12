const User = require('../models/User');

const adminAuthMiddleware = async (req, res, next) => {
    const user = await User.findOne({userId: req.user});

    if (user.role !== 'admin') {
        return res.status(401).json({error: "You are not authorized to perform this action!"});
    }
    next();
};

module.exports = adminAuthMiddleware;