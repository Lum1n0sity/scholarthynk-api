const express = require("express");
const router = express.Router();
const uploadProfilePic = require("../middleware/profilePictureMiddleware");
const {uploadProfilePicture, getProfilePicture} = require("../controllers/profilePictureController");

router.post('/upload', uploadProfilePic, uploadProfilePicture);
router.get('/get', getProfilePicture);

module.exports = router;