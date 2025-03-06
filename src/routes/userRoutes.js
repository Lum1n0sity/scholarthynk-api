const express = require("express");
const router = express.Router();
const { getUserData, loginUser, signUpUser, verifyAuthToken, deleteAccount } = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

router.post('/login', loginUser);
router.post('/signup', signUpUser);
router.get('/data', authMiddleware, getUserData);
router.get('/verify', authMiddleware, verifyAuthToken);
router.delete('/delete', authMiddleware, deleteAccount);

module.exports = router;