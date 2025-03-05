const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema({
    userId: String,
    name: String,
    parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: "notes" },
    type: String,
    lastEdited: Date,
    children: [{ type: mongoose.Schema.Types.ObjectId, ref: "notes" }],
    fileContent: String
});

const Note = mongoose.model("Note", noteSchema);

module.exports = Note;