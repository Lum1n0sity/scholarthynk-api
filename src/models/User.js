const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    userId: String,
    name: String,
    email: String,
    password: String,
    createdAt: Date
});

const User = mongoose.model("User", userSchema);

module.exports = User;