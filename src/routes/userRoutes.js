const express = require("express");
const router = express.Router();
const { getUserData, loginUser, signUpUser, verifyAuthToken, deleteAccount } = require("../controllers/userController");

router.post('/login', loginUser);
router.post('/signup', signUpUser);
router.get('/data', getUserData);
router.get('/verify', verifyAuthToken);
router.delete('/delete', deleteAccount);

module.exports = router;