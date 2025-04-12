const express = require("express");
const router = express.Router();
const { getUserData, loginUser, signUpUser, verifyAuthToken, deleteAccount, logoutUser, updateRole } = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const adminAuthMiddleware = require("../middleware/adminAuthMiddleware");
const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes timout
    max: 5, // 5 request per windowMs per IP
    message: {error: "Too many login attempts, please try again later"}
})

router.post('/login', authLimiter, loginUser);
router.post('/signup', authLimiter, signUpUser);
router.post('/logout', authMiddleware, logoutUser);
router.get('/data', authMiddleware, getUserData);
router.post('/role', authMiddleware, adminAuthMiddleware, updateRole);
router.get('/verify', authMiddleware, verifyAuthToken);
router.delete('/delete', authMiddleware, deleteAccount);

module.exports = router;