const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
    userId: String,
    name: String,
    date: String,
});

const Event = mongoose.model("Event", eventSchema);

module.exports = Event;