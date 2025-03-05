const express = require("express");
const router = express.Router();
const { getEvents, newEvent, deleteEvent } = require("../controllers/eventController");

router.get('/get', getEvents);
router.post('/new', newEvent);
router.delete('/delete', deleteEvent);

module.exports = router;