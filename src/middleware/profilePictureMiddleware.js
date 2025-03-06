const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads/profilePics');
if (!fs.existsSync(uploadDir)) fs.mkdir(uploadDir, { recursive: true });

const storageProfilePics = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/profilePics');
    },
    filename: (req, file, cb) => {
        const userId = req.user;
        if (!userId) {
            return cb(new Error('User ID is required'), null);
        }
        cb(null, userId + '.png');
    },
});

const uploadProfilePic = multer({
    storage: storageProfilePics,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'), false);
        }
        cb(null, true);
    }
}).single('profilePic');

module.exports = uploadProfilePic;