const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const loggingMiddleware = require("../middleware/loggingMiddleware");
const adminMiddleware = require("../middleware/adminAuthMiddleware");
const { getLogs, deleteLog, deleteAllLogs } = require("../controllers/adminController");

router.get('/logs', adminMiddleware, getLogs);
router.post('/delete-log', adminMiddleware, deleteLog);
router.delete('/delete-logs', adminMiddleware, deleteAllLogs);

module.exports = router;