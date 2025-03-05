const logger = require("../config/logger");
const {Event} = require("../models/Event");

const getEvents = async (req, resp) => {
    try {
        if (req.date.length === 0) {
            return resp.status(400).json({error: "You cannot request events for an undefined date!"});
        }

        const events = await Event.find({date: req.date, userId: req.user}).lean();

        resp.status(200).json({events});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again. If this keeps occurring please contact the developer!"});
    }
};

const newEvent = async (req, resp) => {
    try {
        if (req.body.name.length === 0 || req.body.date.length === 0) {
            return resp.status(400).json({error: "Event name or date cannot be empty!"});
        }

        const eventExists = await Event.findOne({name: req.body.name, date: req.body.date, userId: req.user});

        if (eventExists) {
            return resp.status(409).json({error: `There is already an event with the name ${req.body.name} for this date!`});
        }

        const event = new Event({
            userId: req.user,
            name: req.body.name,
            date: req.body.date
        });

        await event.save();

        resp.status(200).json({success: true});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again. If this keeps occurring please contact the developer!"});
    }
};

const deleteEvent = async (req, resp) => {
    try {
        if (req.body.name.length === 0 || req.body.date.length === 0) return resp.status(400).json({error: "Event name or date cannot be empty!"});

        const eventExists = await Event.findOne({userId: req.user, name: req.body.name, date: req.body.date});

        if (!eventExists) return resp.status(404).json({error: "The event you are trying to delete was not found!"});

        await Event.deleteOne({userId: req.user, name: req.body.name, date: req.body.date});
        resp.status(200).json({success: true});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again. If this keeps occurring please contact the developer!"});
    }
};

module.exports = {getEvents, newEvent, deleteEvent};