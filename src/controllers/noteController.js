const logger = require("../config/logger");
const Note = require("../models/Note");

/**
 * Retrieves the full path of a specified note for a given user.
 * Validates the provided parent folder and note ID, and constructs
 * the path from the note up to the root folder.
 *
 * @param {Object} req - The request object containing user and note information.
 * @param {string} req.user - The ID of the user requesting the note path.
 * @param {string} req.body.parent - The ID of the parent folder of the note.
 * @param {string} req.body.noteId - The ID of the note to retrieve the path for.
 * @param {Object} resp - The response object used to send the path or error messages.
 * @returns {Promise<void>}
 * @throws {Error} If the parent folder or note is not found, or if there is a server error.
 */
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
        logger.fatal(err);
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
        logger.fatal(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

/**
 * Retrieves a specific note for the given user based on the provided title and path.
 * Validates the existence of the parent folders in the path and the note itself.
 * Returns the note if found, or an error if any part of the path or note is not found.
 *
 * @param {Object} req - The request object containing user and note information.
 * @param {string} req.user - The ID of the user requesting the note.
 * @param {string} req.body.title - The title of the note to retrieve.
 * @param {Array<string>} req.body.path - The path of folders leading to the note.
 * @param {Object} resp - The response object used to send the note or error messages.
 * @returns {Promise<void>}
 * @throws {Error} If the parent path or note is not found, or if there is a server error.
 */
const getNote = async (req, resp) => {
    const noteTitle = req.body.title;
    const parentPath = req.body.path;
    const userId = req.user;

    if (!parentPath) return resp.status(400).json({error: "The location of the note was not provided!"});

    try {
        let folderIds = [];

        for (const segment of parentPath) {
            if (segment === "root") {
                folderIds.push(null);
                continue;
            }

            const matchedFolder = await Note.findOne({
                userId: userId,
                type: "folder",
                name: segment,
                parentFolder: folderIds[folderIds.length - 1] ?? null
            });

            if (!matchedFolder) return resp.status(404).json({error: `Folder "${segment}" was not found in path!`});

            folderIds.push(matchedFolder._id);
        }

        let note = null;

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
        logger.fatal(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

/**
 * Creates a new note for the user at the specified parent path.
 * Validates the existence of the parent folders in the path.
 * If the note is successfully created, updates the parent folder to include the new note in its children.
 *
 * @param {Object} req - The request object containing user and note information.
 * @param {string} req.user - The ID of the user creating the note.
 * @param {Array<string>} req.body.path - The path of folders leading to where the note should be created.
 * @param {Object} resp - The response object used to send success or error messages.
 * @returns {Promise<void>}
 * @throws {Error} If the parent path is not provided, any folder in the path is not found,
 * or if there is a server error.
 */
const newNote = async (req, resp) => {
    const userId = req.user;
    const parentPath = req.body.path;

    if (!parentPath) return resp.status(400).json({error: "The location to create the note was not provided!"});

    try {
        let folderIds = [];

        for (const segment of parentPath) {
            if (segment === "root") {
                folderIds.push(null);
                continue;
            }

            const matchedFolder = await Note.findOne({
                userId: userId,
                type: "folder",
                name: segment,
                parentFolder: folderIds[folderIds.length - 1] ?? null
            });

            if (!matchedFolder) return resp.status(404).json({error: `Folder "${segment}" was not found in path!`});

            folderIds.push(matchedFolder._id);
        }

        const parentFolderId = folderIds[folderIds.length - 1];
        const parentFolder = await Note.findOne({userId: userId, _id: parentFolderId});

        const newNote = new Note({
            userId: userId,
            name: "Untitled",
            parentFolder: parentFolder ? parentFolderId : null,
            type: "note",
            lastEdited: new Date(),
            children: [],
            fileContent: ""
        });

        await newNote.save();

        if (parentFolder !== null) {
            await Note.updateOne(
                {userId: userId, _id: newNote.parentFolder},
                {$push: {children: newNote._id}}
            );
        }

        resp.status(200).json({success: true});
    } catch (err) {
        logger.fatal(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

/**
 * Updates a note with the provided title, content, and parent path.
 * Validates the note title and ensures it does not already exist.
 * Updates the note's content and title in the database.
 *
 * @param {Object} req - The request object containing user and note information.
 * @param {string} req.user - The ID of the user updating the note.
 * @param {string} req.body.title - The new title of the note to update.
 * @param {string} req.body.oldTitle - The old title of the note to update.
 * @param {string} req.body.content - The updated content of the note.
 * @param {Array<string>} req.body.path - The path of folders leading to the note.
 * @param {Object} resp - The response object used to send success or error messages.
 * @returns {Promise<void>}
 * @throws {Error} If the parent path is not provided, any folder in the path is not found,
 * or if there is a server error.
 */
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

        for (const segment of parentPath) {
            if (segment === "root") {
                folderIds.push(null);
                continue;
            }

            const matchedFolder = await Note.findOne({
                userId: userId,
                type: "folder",
                name: segment,
                parentFolder: folderIds[folderIds.length - 1] ?? null
            });

            if (!matchedFolder) return resp.status(404).json({error: `Folder "${segment}" was not found in path!`});

            folderIds.push(matchedFolder._id);
        }

        let note = null;

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
        logger.fatal(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

module.exports = {getNotePath, getNotes, getNote, newNote, updateNote};