const express = require("express");
const router = express.Router();
const {getAssignments, updateAssignment, deleteAssignment, newAssignment} = require("../controllers/assignmentController");

router.get('/get', getAssignments);
router.post('/new', newAssignment);
router.put('/update', updateAssignment);
router.delete('/delete', deleteAssignment);

module.exports = router;