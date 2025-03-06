const express = require("express");
const router = express.Router();
const {getFVItems, deleteFVItem, renameFVItem, newFolder} = require("../controllers/fileViewerController");

router.post('/get', getFVItems);
router.post('/create', newFolder);
router.put('/rename', renameFVItem);
router.delete('/delete', deleteFVItem);

module.exports = router;