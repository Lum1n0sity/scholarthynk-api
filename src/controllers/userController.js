const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const User = require("../models/User");
const Event = require("../models/Event");
const Assignment = require("../models/Assignment");
const Note = require("../models/Note");
const logger = require("../config/logger");

require('dotenv').config();

const getUserData = async (req, resp) => {
    try {
        const user = await User.findOne({userId: req.user}, {password: 0, _id: 0, createdAt: 0});
        if (!user) return resp.status(404).json({error: "Your account was not found!"});

        resp.status(200).json({user: user});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

const loginUser = async (req, resp) => {
    try {
        const user = await User.findOne({email: req.body.email});
        if (!user) return resp.status(404).json({error: `There is no user with the email ${req.body.email}!`});

        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) return resp.status(401).json({error: "Invalid credentials!"});

        const token = generateAuthToken(user.userId);

        resp.status(200).json({authToken: token});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

const signUpUser = async (req, resp) => {
    try {
        if (req.body.name.length === 0 || req.body.email.length === 0 || req.body.password.length === 0) {
            return resp.status(400).json({error: "All fields are required!"});
        }

        const userExists = await User.findOne({email: req.body.email});
        if (userExists) return resp.status(409).json({error: "User already exists!"});

        const userId = generateUserId();
        const authToken = generateAuthToken(userId);
        const hash = await bcrypt.hash(req.body.password, 12)

        const newUser = new User({
            userId: userId,
            name: req.body.name,
            email: req.body.email,
            password: hash,
            createdAt: new Date()
        });

        await newUser.save();

        resp.status(200).json({authToken: authToken});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

const verifyAuthToken = (req, resp) => {
    resp.status(200).json({success: true, userId: req.user});
};

const deleteAccount = async (req, resp) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        await Assignment.deleteMany({userId: req.user}).session(session);

        await Event.deleteMany({userId: req.user}).session(session);

        await Note.deleteMany({userId: req.user}).session(session);

        const filePath = path.join(__dirname, '../../uploads/profilePics', `${req.user}.png`);
        try {
            await fs.promises.unlink(filePath);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                throw new Error(`Error deleting profile picture: ${err.message}`);
            }
        }

        const user = await User.findOne({userId: req.user}).session(session);
        if (!user) throw new Error("User not found!");

        await user.deleteOne({userId: req.user}).session(session);

        const userExists = await User.findOne({userId: req.user}).session(session);
        if (userExists) throw new Error("Unable to delete user!");

        await session.commitTransaction();

        resp.status(200).json({success: true});
    } catch (err) {
        await session.abortTransaction();

        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    } finally {
        await session.endSession();
    }
};

/**
 * Generates an authorization token for the given user ID.
 * The token is signed with the `secretKey` and expires in 7 days.
 * @param {string} userId - The user ID to generate the token for.
 * @returns {string} The generated authorization token.
 */
function generateAuthToken(userId) {
    return jwt.sign({userId}, process.env.SECRET_KEY, {expiresIn: '7d'});
}

/**
 * Generates a unique user ID.
 * @returns {string} A unique user ID.
 */
function generateUserId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

module.exports = {getUserData, loginUser, signUpUser, verifyAuthToken, deleteAccount};