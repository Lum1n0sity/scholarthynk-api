const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminAuthMiddleware");
const { getLogs } = require("../controllers/adminController");

router.get('/logs', authMiddleware, adminMiddleware, getLogs);

module.exports = router;