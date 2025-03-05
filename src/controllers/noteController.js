const logger = require("../config/logger");
const {Note} = require("../models/Note");

const getNotePath = async (req, resp) => {
    const userId = req.user;
    const parent = req.body.parent;

    if (!parent) return resp.status(400).json({error: "There was no parent folder of the note provided!"});

    try {
        const parentFolder = await Note.findOne({userId: userId, _id: parent, type: "folder"});
        if (!parentFolder) return resp.status(404).json({error: "The specified parent folder was not found or you don't have access to it"});

        const noteId = req.body.noteId;
        if (!noteId) return resp.status(400).json({error: "The note id is required"});

        const note = await Note.findOne({userId: userId, _id: noteId, parentFolder: parent});
        if (!note) return resp.status(404).json({error: "The note you are trying to open was not found"});

        let path = [note.name];

        let currentFolderId = note.parentFolder;
        while (currentFolderId) {
            const folder = await Note.findOne({userId: userId, _id: currentFolderId});
            if (!folder) break;
            path.unshift(folder.name);
            currentFolderId = folder.parentFolder;
        }

        path.unshift("root");

        return resp.status(200).json({path: path});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

/**
 * This function gets all notes for a given user to be displayed in
 * the recent notes section of the dashboard
 *
 * @function getNote
 * @description Returns all notes for a given user
 * @param {Object} req - The Express request object
 * @param {Object} resp - The Express response object
 * @returns {Promise<void>}
 * @throws {Error} If there is an internal server error
 */
const getNotes = async (req, resp) => {
    const userId = req.user;

    try {
        const notes = await Note.find({userId: userId, type: "note"}).lean();

        resp.status(200).json({notes: notes});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

const getNote = async (req, resp) => {
    const noteTitle = req.body.title;
    const parentPath = req.body.path;
    const userId = req.user;

    if (!parentPath) return resp.status(400).json({error: "The location of the note was not provided!"});

    try {
        let folderIds = [];

        for (const folder of parentPath) {
            if (folder !== "root") {
                const id = await Note.findOne({
                    userId: userId,
                    type: "folder",
                    parentFolder: folder === "root" ? null : folderIds[folderIds.length - 1]
                });
                folderIds.push(id._id);
            }
        }

        let note = null;

        /**
         * Original condition was: parentPath.length !== 1 && parentPath[0] !== "root"
         * The problem with this condition is that it will never be true since parentPath[0] should always be "root"
         * If the user then opens a note in a folder, it will never find this note in the database
         */
        if (parentPath.length !== 1) {
            note = await Note.findOne({
                userId: userId,
                name: noteTitle,
                parentFolder: folderIds[folderIds.length - 1],
                type: "note"
            });
        } else {
            note = await Note.findOne({userId: userId, name: noteTitle, type: "note"});
        }

        if (!note) return resp.status(404).json({error: "The note you are trying to open was not found"});

        return resp.status(200).json({note: note});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

const newNote = async (req, resp) => {
    const userId = req.user;
    const parentPath = req.body.path;

    if (!parentPath) return resp.status(400).json({error: "The location to create the note was not provided!"});

    try {
        let folderIds = [];

        for (const folder of parentPath) {
            if (folder !== "root") {
                const id = await Note.findOne({
                    userId: userId,
                    type: "folder",
                    parentFolder: folder === "root" ? null : folderIds[folderIds.length - 1]
                });
                folderIds.push(id._id);
            }
        }

        const parentFolderId = folderIds[folderIds.length - 1];
        const parentFolder = await Note.findOne({userId: userId, _id: parentFolderId});

        const newNote = new Note({
            name: "Untitled",
            userId: userId,
            parentFolder: parentFolder ? parentFolderId : null,
            type: "note",
            lastEdited: new Date(),
            children: [],
            fileContent: ""
        });

        await newNote.save();

        resp.status(200).json({success: true});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

const updateNote = async (req, resp) => {
    const userId = req.user;
    const noteTitle = req.body.title;
    const oldNoteTitle = req.body.oldTitle;
    const noteContent = req.body.content;
    const parentPath = req.body.path;

    if (!parentPath) return resp.status(400).json({error: "The location of the note was not provided!"});

    try {
        if (noteTitle.length === 0 || oldNoteTitle.length === 0) return resp.status(400).json({error: "The title of the note can not be empty!"});

        if (noteTitle === "root") return resp.status(400).json({error: "You cannot name the note 'root'!"});

        let folderIds = [];

        for (const folder of parentPath) {
            if (folder !== "root") {
                const id = await Note.findOne({
                    userId: userId,
                    type: "folder",
                    parentFolder: folder === "root" ? null : folderIds[folderIds.length - 1]
                });
                folderIds.push(id._id);
            }
        }

        let note = null;

        /**
         * Original condition was: parentPath.length !== 1 && parentPath[0] !== "root"
         * The problem with this condition is that it will never be true since parentPath[0] should always be "root"
         * If the user then opens a note in a folder, it will never find this note in the database
         */
        if (parentPath.length !== 1) {
            note = await Note.findOne({
                userId: userId,
                name: oldNoteTitle,
                parentFolder: folderIds[folderIds.length - 1],
                type: "note"
            });
        } else {
            note = await Note.findOne({userId: userId, name: oldNoteTitle, parentFolder: null, type: "note"});
        }

        if (!note) return resp.status(404).json({error: "The note you are trying to update was not found"});

        await Note.updateOne(
            {userId: userId, _id: note._id},
            {$set: {fileContent: noteContent, name: noteTitle, lastEdited: new Date()}}
        );

        resp.status(200).json({success: true});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

module.exports = {getNotePath, getNotes, getNote, newNote, updateNote};