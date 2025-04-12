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

/**
 * Returns the user data associated with the user ID provided in the request.
 * If the user ID does not exist, a 404 Not Found response is returned.
 * If an internal error occurs, a 500 Internal Server Error response is returned.
 *
 * @param {Object} req - The request object.
 * @param {string} req.user - The ID of the user.
 * @param {Object} resp - The response object.
 * @returns {Promise<void>}
 * @throws {Error} If the user ID does not exist or if an internal error occurs.
 */
const getUserData = async (req, resp) => {
    try {
        const user = await User.findOne({userId: req.user}, {password: 0, _id: 0, createdAt: 0, lastLogin: 0});
        if (!user) return resp.status(404).json({error: "Your account was not found!"});

        resp.status(200).json({user: user});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

/**
 * Logs a user in and returns a JSON Web Token that can be used to authenticate the user.
 * The request body must contain the user's email and password.
 * If the user does not exist, a 404 Not Found response is returned.
 * If the credentials are invalid, a 401 Unauthorized response is returned.
 * If an internal error occurs, a 500 Internal Server Error response is returned.
 *
 * @param {Object} req - The request object.
 * @param {string} req.body.email - The email of the user.
 * @param {string} req.body.password - The password of the user.
 * @param {Object} resp - The response object.
 * @returns {Promise<void>}
 * @throws {Error} If the user does not exist, if the credentials are invalid, or if an internal error occurs.
 */
const loginUser = async (req, resp) => {
    try {
        const user = await User.findOne({email: req.body.email});
        if (!user) return resp.status(404).json({error: `There is no user with the email ${req.body.email}!`});

        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) return resp.status(401).json({error: "Invalid credentials!"});

        const token = generateAuthToken(user.userId);

        await User.updateOne({email: req.body.email}, {$set: {status: "online", lastLogin: new Date()}});

        resp.status(200).json({authToken: token});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

/**
 * Signs up a new user.
 * The request body must contain the user's name, email, and password.
 * If any of the fields are empty, a 400 Bad Request response is returned.
 * If the email already exists, a 409 Conflict response is returned.
 * If an internal error occurs, a 500 Internal Server Error response is returned.
 * On success, a JSON Web Token is returned in the response body.
 *
 * @param {Object} req - The request object.
 * @param {string} req.body.name - The name of the user.
 * @param {string} req.body.email - The email of the user.
 * @param {string} req.body.password - The password of the user.
 * @param {Object} resp - The response object.
 * @returns {Promise<void>}
 * @throws {Error} If any of the fields are empty, if the email already exists, or if an internal error occurs.
 */
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
            createdAt: new Date(),
            role: "user",
            lastLogin: new Date(),
            status: "online",
            isDisabled: false
        });

        await newUser.save();

        resp.status(200).json({authToken: authToken});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

/**
 * Logs a user out and changes their status to "offline".
 * The request body must contain the user's email.
 * If the email is not provided, a 400 Bad Request response is returned.
 * If the user does not exist, a 200 OK response is returned with an error message.
 * If an internal error occurs, a 500 Internal Server Error response is returned.
 *
 * @param {Object} req - The request object.
 * @param {string} req.body.email - The email of the user.
 * @param {Object} resp - The response object.
 * @returns {Promise<void>}
 * @throws {Error} If the email is not provided, if the user does not exist, or if an internal error occurs.
 */
const logoutUser = async (req, resp) => {
    try {
        const userExists = await User.findOne({userId: req.user});
        if (!userExists) return resp.status(200).json({error: "User doesn't exists!"});

        await User.updateOne({userId: req.user}, {$set: {status:"offline"}});

        resp.status(200).json({success: true});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
}

/**
 * Updates the role of the user.
 * The request body must contain the action to take, either "promote" or "demote".
 * If the action is "promote", the user's role is set to "admin".
 * If the action is "demote", the user's role is set to "user".
 * If the action is not one of the above, a 400 Bad Request response is returned.
 * If an internal error occurs, a 500 Internal Server Error response is returned.
 *
 * @param {Object} req - The request object.
 * @param {string} req.body.action - The action to take, either "promote" or "demote".
 * @param {Object} resp - The response object.
 * @returns {Promise<void>}
 * @throws {Error} If the action is invalid, or if an internal error occurs.
 */
const updateRole = async (req, resp) => {
    try {
        const action = req.body.action;

        const userExists = await User.findOne({userId: req.user});
        if (!userExists) return resp.status(200).json({error: "User doesn't exists!"});

        if (action === "promote") {
            await User.updateOne({userId: req.user}, {$set: {role: "admin"}});
            return resp.status(200).json({success: true});
        } else if (action === "demote") {
            await User.updateOne({userId: req.user}, {$set: {role: "user"}});
            return resp.status(200).json({success: true});
        } else {
            return resp.status(400).json({error: "Invalid action!"});
        }
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
}

/**
 * Verifies a given authorization token and returns the user ID if valid.
 * If the token is invalid, it returns a 401 Unauthorized response.
 * @param {Object} req - The request object.
 * @param {string} req.user - The ID of the user, if the token is valid.
 * @param {Object} resp - The response object.
 * @returns {Promise<void>}
 * @throws {Error} If the token is invalid.
 */
const verifyAuthToken = (req, resp) => {
    resp.status(200).json({success: true, userId: req.user});
};

/**
 * Deletes the user account associated with the given user ID.
 * The request body must contain the user ID.
 * If the user ID is invalid, a 400 Bad Request response is returned.
 * If an internal error occurs, a 500 Internal Server Error response is returned.
 * On success, a 200 OK response is returned.
 *
 * @param {Object} req - The request object.
 * @param {string} req.user - The ID of the user to delete.
 * @param {Object} resp - The response object.
 * @returns {Promise<void>}
 * @throws {Error} If the user ID is invalid, or if an internal error occurs.
 */
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

module.exports = {getUserData, loginUser, signUpUser, logoutUser, verifyAuthToken, deleteAccount, updateRole};