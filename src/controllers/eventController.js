const logger = require("../config/logger");
const Event = require("../models/Event");

/**
 * This function gets all events for a given user for a given date
 * @function getEvents
 *
 * @param {Object} req - The Express request object
 * @param {Object} resp - The Express response object
 * @returns {Promise<void>}
 * @throws {Error} If the date is undefined or there is an internal server error
 */
const getEvents = async (req, resp) => {
    try {
        if (!req.body.date || req.body.date.length === 0) return resp.status(400).json({error: "You cannot request events for an undefined date!"});

        const events = await Event.find({date: req.body.date, userId: req.user}).lean();

        resp.status(200).json({events: events});
    } catch (err) {
        logger.fatal(err);
        resp.status(500).json({error: "There was an internal server error! Please try again. If this keeps occurring please contact the developer!"});
    }
};

/**
 * This function creates a new event for a given user.
 *
 * @function newEvent
 * @description Creates a new event entry for a specified user and date.
 * @param {Object} req - The Express request object, containing event details in the body.
 * @param {Object} resp - The Express response object.
 * @returns {Promise<void>}
 * @throws {Error} If the event name or date is missing, if the event already exists, or if there is an internal server error.
 */
const newEvent = async (req, resp) => {
    try {
        if (!req.body.name || !req.body.date || req.body.name.length === 0 || req.body.date.length === 0) return resp.status(400).json({error: "Event name or date cannot be empty!"});

        const eventExists = await Event.findOne({name: req.body.name, date: req.body.date, userId: req.user});

        if (eventExists) return resp.status(409).json({error: `There is already an event with the name ${req.body.name} for this date!`});

        const event = new Event({
            userId: req.user,
            name: req.body.name,
            date: req.body.date
        });

        await event.save();

        resp.status(200).json({success: true});
    } catch (err) {
        logger.fatal(err);
        resp.status(500).json({error: "There was an internal server error! Please try again. If this keeps occurring please contact the developer!"});
    }
};

/**
 * This function deletes an event for a given user.
 *
 * @function deleteEvent
 * @description Deletes an event entry for a specified user, name, and date.
 * @param {Object} req - The Express request object, containing event details in the body.
 * @param {Object} resp - The Express response object.
 * @returns {Promise<void>}
 * @throws {Error} If the event name or date is missing, if the event does not exist, or if there is an internal server error.
 */
const deleteEvent = async (req, resp) => {
    try {
        if (!req.body.name || !req.body.date || req.body.name.length === 0 || req.body.date.length === 0) return resp.status(400).json({error: "Event name or date cannot be empty!"});

        const eventExists = await Event.findOne({userId: req.user, name: req.body.name, date: req.body.date});

        if (!eventExists) return resp.status(404).json({error: "The event you are trying to delete was not found!"});

        await Event.deleteOne({userId: req.user, name: req.body.name, date: req.body.date});

        resp.status(200).json({success: true});
    } catch (err) {
        logger.fatal(err);
        resp.status(500).json({error: "There was an internal server error! Please try again. If this keeps occurring please contact the developer!"});
    }
};

module.exports = {getEvents, newEvent, deleteEvent};