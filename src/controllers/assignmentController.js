const logger = require("../config/logger");
const Assignment = require("../models/Assignment");

/**
 * This function returns all assignments for a given user.
 * It also deletes any expired assignments and removes them from the list.
 *
 * @function getAssignments
 * @description Returns all assignments for a given user
 * @param {Object} req - The Express request object
 * @param {Object} resp - The Express response object
 * @returns {Promise<void>}
 * @throws {Error} If there is an internal server error
 */
const getAssignments = async (req, resp) => {
    try {
        const assignments = await Assignment.find({userId: req.user}).lean();

        resp.status(200).json({assignments: assignments});
    } catch (err) {
        logger.fatal(err);
        resp.status(500).json({error: "There was an internal server error! Please try again. If this keeps occurring please contact the developer!"});
    }
};

/**
 * This function creates a new assignment.
 *
 * @function newAssignment
 * @description Creates a new assignment
 * @param {Object} req - The Express request object
 * @param {Object} resp - The Express response object
 * @returns {Promise<void>}
 * @throws {Error} If there is an internal server error
 */
const newAssignment = async (req, resp) => {
    const {title, dueDate, subject, priority, description} = req.body;

    try {
        if (!title || !dueDate || !subject || !priority) return resp.status(400).json({error: "Fill out all required fields (title, due date, subject, priority)!"});

        const assignmentExists = await Assignment.findOne({userId: req.user, title: title});
        if (assignmentExists) return resp.status(409).json({error: `There already is an assignment with the name ${title}!`});

        const assignment = new Assignment({
            userId: req.user,
            title: title,
            dueDate: dueDate,
            subject: subject,
            status: "open",
            priority: priority,
            description: description
        });

        await assignment.save();

        resp.status(200).json({success: true});
    } catch (err) {
        logger.fatal(err);
        resp.status(500).json({error: "There was an internal server error! Please try again. If this keeps occurring please contact the developer!"});
    }
};

/**
 * This function updates an existing assignment.
 *
 * @function updateAssignment
 * @description Updates an existing assignment
 * @param {Object} req - The Express request object
 * @param {Object} resp - The Express response object
 * @returns {Promise<void>}
 * @throws {Error} If there is an internal server error
 */
const updateAssignment = async (req, resp) => {
    const assignment = req.body.assignment;

    try {
        if (!assignment) return resp.status(400).json({error: "The assignment you are trying to delete cannot be empty!"});

        const currentDate = new Date();

        const assignmentExists = await Assignment.findOne({userId: req.user, title: assignment.title});

        if (!assignmentExists) return resp.status(404).json({error: "The assigment you are trying to update was not found!"});

        await Assignment.updateOne(
            {userId: req.user, title: assignment.title},
            {
                $set: {
                    subject: assignment.subject,
                    status: assignment.status,
                    priority: assignment.priority,
                    description: assignment.description,
                    expire: assignment.status === "done" ? new Date().setDate(currentDate.getDate() + 10) : null
                }
            }
        );

        resp.status(200).json({success: true});
    } catch (err) {
        logger.fatal(err);
        resp.status(500).json({error: "There was an internal server error! Please try again. If this keeps occurring please contact the developer!"});
    }
};

/**
 * This function deletes an existing assignment.
 *
 * @function deleteAssignment
 * @description Deletes an existing assignment
 * @param {Object} req - The Express request object
 * @param {Object} resp - The Express response object
 * @returns {Promise<void>}
 * @throws {Error} If there is an internal server error
 */
const deleteAssignment = async (req, resp) => {
    try {
        if (!req.body.assignment) return resp.status(400).json({error: "The assignment you are trying to delete cannot be empty!"});

        const assignmentExists = await Assignment.findOne({userId: req.user, title: req.body.assignment.title});
        if (!assignmentExists) return resp.status(404).json({error: "The assigment you are trying to delete was not found!"});

        await Assignment.deleteOne({userId: req.user, title: req.body.assignment.title});

        resp.status(200).json({success: true});
    } catch (err) {
        logger.fatal(err);
        resp.status(500).json({error: "There was an internal server error! Please try again. If this keeps occurring please contact the developer!"});
    }
}

module.exports = {getAssignments, newAssignment, updateAssignment, deleteAssignment};