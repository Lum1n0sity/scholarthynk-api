const cron = require("node-cron");
const connectDB = require("../config/dbConfig");
const Event = require("../models/Event");
const logger = require("../config/logger");

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
        console.error("Error deleting old events: ", err);
        logger.error("CronJob error: Error deleting old events: ", err);
    }
}

cron.schedule("0 0 1 * *", deleteOldEvents, {
    timezone: "Europe/Berlin"
});

logger.info("Cron job for deleting old events is running...");
console.log("Cron job for deleting old events is running...");
