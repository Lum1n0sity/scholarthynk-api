const fs = require('fs');
const path = require('path');
const readline = require('readline');
const logger = require('../config/logger');

const LOG_FILE_PATH = path.join(__dirname, '../../logs/scholarthynk-api.log');

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

        const fileStream = fs.createReadStream(LOG_FILE_PATH);

        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        const currentTime = Date.now();
        const twentyFourHoursAgo = currentTime - 24 * 60 * 60 * 1000;

        let unableToLoadAllLines = false;

        for await (const line of rl) {
            if (line.trim()) {
                try {
                    const logEntry = JSON.parse(line);

                    const logTime = new Date(logEntry.time).getTime();
                    if (!isNaN(logTime) && logTime >= twentyFourHoursAgo) {
                        logs.push(logEntry);
                    }
                } catch (err) {
                    logger.warn("Failed to parse line: ", line, err);
                }
            }
        }

        resp.status(200).json({logs: logs});
    } catch (err) {
        logger.fatal(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
}

/**
 * Deletes a specific log entry from the log file using the provided log ID.
 *
 * @function deleteLog
 * @description Searches for a log entry by its ID and removes it from the log file if found.
 * @param {Object} req - The Express request object containing the log ID in the request body.
 * @param {Object} resp - The Express response object used to send success or error messages.
 * @returns {Promise<void>}
 * @throws {Error} If there is an internal server error or if the log entry is not found.
 */
const deleteLog = async (req, resp) => {
    const logId = req.body.id;
    const logs = [];

    try {
        const fileStream = fs.createReadStream(LOG_FILE_PATH);

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
                    logger.warn("Failed to parse line: ", line, err);
                }
            }
        }

        let updatedLogs = [...logs];

        for (let i = 0; i < updatedLogs.length; i++) {
            // console.log(updatedLogs[i].id, " vs. ", logId);
            if (updatedLogs[i].id === logId) {
                updatedLogs.splice(i, 1);
                // console.log("deleted");
                break;
            }
        }

        if (updatedLogs.length === logs.length) {
            logger.warn(`Log with the id ${logId} was not found!`);
            return resp.status(404).json({error: `Log with the id ${logId} was not found!`});
        }

        const updatedContent = updatedLogs.map(log => JSON.stringify(log)).join('\n') + '\n';

        fs.writeFileSync(LOG_FILE_PATH, updatedContent, 'utf8');

        resp.status(200).json({success: true});
    } catch(err) {
        logger.fatal(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
}

/**
 * Deletes all logs from the log file.
 *
 * @function deleteAllLogs
 * @description Deletes all logs from the log file.
 * @param {Object} req - The Express request object.
 * @param {Object} resp - The Express response object.
 * @returns {Promise<void>}
 * @throws {Error} If there is an internal server error.
 */
const deleteAllLogs = async (req, resp) => {
    try {
        fs.truncateSync(LOG_FILE_PATH);
        resp.status(200).json({success: true});
    } catch (err) {
        logger.fatal(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
}

module.exports = {
    getLogs,
    deleteLog,
    deleteAllLogs
};