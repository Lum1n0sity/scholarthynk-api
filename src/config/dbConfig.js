const mongoose = require('mongoose');
const logger = require('./logger');

require('dotenv').config();

/**
 * Connects to the MongoDB instance using the MONGODB_URI environment variable.
 * @throws {Error} if the connection to MongoDB fails
 * @returns {Promise<void>} a promise that resolves when the connection is established
 */
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 45000
        });
        logger.info("MongoDB connected!");
        console.log("MongoDB connected!");
    } catch (err) {
        logger.error(err);
        console.error(err);

        process.emit('db:connectionError', err);
    }
}

module.exports = connectDB;