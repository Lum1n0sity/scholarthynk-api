const express = require("express");
const router = express.Router();
const {getNote, getNotePath, getNotes, newNote, updateNote} = require("../controllers/noteController");

router.post('/get/notePath', getNotePath);
router.get('/get/notes', getNotes);
router.post('/get/note', getNote);
router.post('/new', newNote);
router.put('/update', updateNote);

module.exports = router;