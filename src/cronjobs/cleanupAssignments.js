const cron = require("node-cron");
const connectDB = require("../config/dbConfig");
const Assignment = require("../models/Assignment");
const logger = require("../config/logger");

/**
 * Deletes expired assignments from the database.
 *
 * This function connects to the database and removes all assignments
 * whose expiration date is less than or equal to the current date.
 * It logs the number of deleted assignments, and errors if any occur during the process.
 *
 * @returns {Promise<void>}
 * @throws Will log an error if there is an issue connecting to the
 * database or deleting assignments.
 */
async function deleteExpiredAssignments() {
    try {
        await connectDB();

        const result = await Assignment.deleteMany({ expire: { $lte: new Date() } });

        logger.info(`CronJob: Deleted ${result.deletedCount} expired assignments`);
    } catch (err) {
        logger.fatal("CronJob error: Error deleting expired assignments: ", err);
    }
}

cron.schedule("0 0 * * *", deleteExpiredAssignments, {
    timezone: "Europe/Berlin"
});

logger.info("Cron job for deleting expired assignments is running...");
