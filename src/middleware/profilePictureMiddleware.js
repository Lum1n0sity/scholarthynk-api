const multer = require("multer");
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