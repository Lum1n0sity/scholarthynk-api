const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema({
    userId: String,
    title: String,
    dueDate: String,
    subject: String,
    status: String,
    priority: String,
    description: String,
    expire: Date
});

const Assignment = mongoose.model("Assignment", assignmentSchema);

module.exports = Assignment;