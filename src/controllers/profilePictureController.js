const path = require("path");
const {glob} = require('glob');
const logger = require("../config/logger");

const uploadProfilePicture = async (req, resp) => {
    if (req.file) {
        logger.info({
            message: "File uploaded",
            user: req.user?.id || "Unknown",
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
        resp.status(200).json({success: true});
    } else {
        logger.warn("Unable to upload profile picture!");
        resp.status(400).json({success: false, error: 'No file uploaded!'});
    }
};

const getProfilePicture = async (req, resp) => {
    const userId = req.user;
    if (!userId) {
        return resp.status(400).json({error: "There was no user provided!"});
    }

    const filePathPattern = path.join(__dirname, '../../uploads/profilePics', `${userId}.*`);

    try {
        const files = await glob(filePathPattern);

        if (files.length === 0) {
            logger.warn("Profile picture not found!");
            return resp.status(404).json({error: "Profile picture not found!"});
        }

        resp.sendFile(files[0]);
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

module.exports = {uploadProfilePicture, getProfilePicture};