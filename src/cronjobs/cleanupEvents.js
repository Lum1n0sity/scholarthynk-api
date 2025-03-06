const cron = require("node-cron");
const connectDB = require("../config/dbConfig");
const Event = require("../models/Event");
const logger = require("../config/logger");

/**
 * Deletes events from the database that are older than the current month.
 *
 * This function connects to the database and retrieves all events.
 * It iterates through each event, checks if the event date is before
 * the current month, and deletes those events from the database.
 *
 * @returns {Promise<void>}
 * @throws Will log an error if there is an issue connecting to the
 * database or deleting events.
 */
async function deleteOldEvents() {
    try {
        await connectDB();

        const events = await Event.find({}).lean();

        for (let i = 0; i < events.length; i++) {
            const event = events[i];

            const [day, month, year] = event.date.split(".");

            const date = new Date(`${year}-${month}-01T00:00:00.000Z`);
            const currentDate = new Date();

            let eventYear = date.getUTCFullYear();
            let eventMonth = date.getUTCMonth();

            let currentYear = currentDate.getUTCFullYear();
            let currentMonth = currentDate.getUTCMonth();

            if (eventYear < currentYear || (eventYear === currentYear && eventMonth < currentMonth)) {
                await Event.deleteOne({name: event.name, date: event.date});
            }
        }

    } catch (err) {
        logger.error("CronJob error: Error deleting old events: ", err);
    }
}

cron.schedule("0 0 1 * *", deleteOldEvents, {
    timezone: "Europe/Berlin"
});

logger.info("Cron job for deleting old events is running...");
