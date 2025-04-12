const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    userId: String,
    name: String,
    email: String,
    password: String,
    createdAt: Date,
    role: String,
    lastLogin: Date,
    status: String,
    isDisabled: Boolean
});

const User = mongoose.model("User", userSchema);

module.exports = User;