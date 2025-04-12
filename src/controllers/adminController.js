const fs = require('fs');
const readline = require('readline');
const logger = require('../config/logger');

/**
 * This function reads the last 100 log entries from the log file and returns
 * them to the user as JSON.
 *
 * @function getLogs
 * @description Reads the last 100 log entries from the log file and returns
 * them as JSON.
 * @param {Object} req - The Express request object
 * @param {Object} resp - The Express response object
 * @returns {Promise<void>}
 * @throws {Error} If there is an internal server error
 */
const getLogs = async (req, resp) => {
    try {
        const logs = [];

        const fileStream = fs.createReadStream('../../logs/scholarthynk-api.log');

        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            if (line.trim()) {
                try {
                    const logEntry = JSON.parse(line);
                    logs.push(logEntry);
                } catch (err) {
                    logger.error("Failed to parse line: ", line, err);
                }
            }
        }

        resp.status(200).json({logs: logs});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
}