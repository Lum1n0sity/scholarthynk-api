const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const {glob} = require('glob');
const pino = require('pino');
const fs = require('fs');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const secretKey = process.env.SECRET_KEY;

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 45000
})
    .then(() => {
        console.log('MongoDB connected!');
        logger.info('MongoDB connected!');
    })
    .catch(err => {
        console.error(err);
        logger.error(err);
    });

/**
 * Returns a mongoose database connection object for the given database name.
 * @param {string} dbName - the name of the database
 * @returns {Db} - a mongoose database connection object
 */
function getDatabase(dbName) {
    return mongoose.connection.useDb(dbName, {useCache: true});
}

const transport = pino.transport({
    targets: [
        {
            target: "pino/file",
            options: {destination: "./logs/scholarthynk-api.log", mkdir: true, append: true}
        }
    ]
});

const logger = pino({level: "info"}, transport);

/**
 * Express middleware that checks if the request has a valid authorization token.
 * If the token is valid, it adds the user ID to the request object and calls the next middleware.
 * If the token is invalid or missing, it returns a 401 Unauthorized response.
 * @param {IncomingMessage} req - The request object.
 * @param {ServerResponse} res - The response object.
 * @param {Function} next - The next middleware in the stack.
 */
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({success: false, error: 'Unable to authorize!'});

    const payload = verifyAuthToken(token);
    if (!payload) return res.status(401).json({success: false, error: 'Unable to authorize!'});

    req.user = payload.userId;
    next();
};

/**
 * Express middleware that logs incoming requests using pino.
 * @param {IncomingMessage} req - The request object.
 * @param {ServerResponse} res - The response object.
 * @param {Function} next - The next middleware in the stack.
 */
const loggingMiddleware = (req, res, next) => {
    logger.info({method: req.method, url: req.url, user: req.user || "guest"}, "Incoming request");
    next();
};

app.get('/', async (req, resp) => {
    resp.send('Hello World');
});

app.post('/api/signup', loggingMiddleware, async (req, resp) => {
    const {name, email, password} = req.body;
    const saltRounds = 12;

    try {
        const db = getDatabase('scholarthynk');
        const collection = db.collection('users');

        if (name.length === 0 || email.length === 0 || password.length === 0) {
            return resp.status(400).json({success: false});
        }

        const userExists = await collection.findOne({email: email});
        if (userExists) {
            return resp.status(409).json({success: false, error: 'User already exists!'});
        }

        const userId = generateUserId();
        const authToken = generateAuthToken(userId);
        const hash = await bcrypt.hash(password, saltRounds);

        collection.insertOne({userId: userId, name: name, email: email, password: hash, createdAt: new Date()});
        resp.status(200).json({success: true, authToken: authToken});
    } catch (error) {
        console.error(error);
        logger.error(error);
        resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
});

app.post('/api/login', loggingMiddleware, async (req, resp) => {
    const {email, password} = req.body;

    try {
        const db = getDatabase('scholarthynk');
        if (!db) {
            console.error("Database connection failed!");
            logger.error("Login: Database connection failed!");
            resp.status(500).json({
                success: false,
                error: "There was an error connecting to the database, Please contact the developer immediately!"
            });
        }

        const collection = db.collection('users');
        if (!collection) {
            console.error("Collection 'users' not found!");
            logger.error("Login: Collection 'users' not found!");
            resp.status(500).json({
                success: false,
                error: "There was a database error. Please contact the developer immediately!"
            });
        }

        const user = await collection.findOne({email: email});
        if (!user) return resp.status(401).json({success: false, error: 'Invalid credentials!'});

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return resp.status(401).json({success: false, error: 'Invalid credentials!'});

        const token = generateAuthToken(user.userId);
        resp.json({success: true, authToken: token});
    } catch (error) {
        console.error(error);
        logger.error(error);
        resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
});

app.get('/api/verify', authMiddleware, loggingMiddleware, async (req, resp) => {
    resp.status(200).json({success: true, userId: req.user});
});

app.post('/api/delete-account', authMiddleware, loggingMiddleware, async (req, resp) => {
    try {
        const db = getDatabase('scholarthynk');
        const collection = db.collection('users');

        const user = await collection.findOne({userId: req.user});
        if (!user) return resp.status(404).json({success: false, error: 'User not found!'});

        await collection.deleteOne({userId: req.user});
        resp.status(200).json({success: true});
    } catch (error) {
        console.error(error);
        logger.error(error);
        resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
});

app.get('/api/get-user-data', authMiddleware, loggingMiddleware, async (req, resp) => {
    try {
        const db = getDatabase('scholarthynk');
        const collection = db.collection('users');

        const user = await collection.findOne({userId: req.user}, {projection: {password: 0, _id: 0, createdAt: 0}});
        if (!user) return resp.status(404).json({success: false, error: 'User not found!'});

        resp.status(200).json({success: true, user: user});
    } catch (error) {
        console.error(error);
        logger.error(error);
        resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
});

const storageProfilePics = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/profilePics');
    },
    filename: (req, file, cb) => {
        const userId = req.user;
        if (!userId) {
            return cb(new Error('User ID is required'), null);
        }
        cb(null, userId + '.png');
    },
});

const uploadProfilePic = multer({
    storage: storageProfilePics,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'), false);
        }
        cb(null, true);
    }
}).single('profilePic');

app.post('/api/upload-profile-pic', authMiddleware, loggingMiddleware, uploadProfilePic, async (req, resp) => {
    if (req.file) {
        logger.info({
            message: "File uploaded",
            user: req.user?.id || "Unknown",
            filename: req.file.filename,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
        resp.status(200).json({success: true});
    } else {
        logger.warn("Unable to upload profile picture!");
        resp.status(400).json({success: false, error: 'No file uploaded!'});
    }
});

app.get('/api/get-profile-pic', authMiddleware, loggingMiddleware, async (req, resp) => {
    const userId = req.user;
    if (!userId) {
        return resp.status(400).json({success: false, error: 'User ID is required!'});
    }

    const filePathPattern = path.join(__dirname, '../uploads/profilePics', `${userId}.*`);

    try {
        const files = await glob(filePathPattern);

        if (files.length === 0) {
            logger.warn("Profile picture not found!");
            return resp.status(404).json({success: false, error: 'Profile picture not found'});
        }

        resp.sendFile(files[0]);
    } catch (err) {
        console.error('Error finding profile picture:', err);
        logger.error(err);
        return resp.status(500).json({success: false, error: 'Internal Server Error'});
    }
});

app.post('/api/new-event', authMiddleware, loggingMiddleware, async (req, resp) => {
    const userId = req.user;
    const {name, date} = req.body;

    try {
        const db = getDatabase('scholarthynk');
        const collection = db.collection('events');

        if (name.length === 0 || date.length === 0) {
            return resp.status(400).json({success: false, error: "Event name or date cannot be empty!"});
        }

        const eventExists = await collection.findOne({userId: userId, name: name, date: date});

        if (eventExists) {
            return resp.status(409).json({
                success: false,
                error: `There is already an event with the name ${name} for this date!`
            });
        }

        const event = {userId: userId, name: name, date: date};
        await collection.insertOne(event);
        resp.status(200).json({success: true});
    } catch (error) {
        console.error(error);
        logger.error(error);
        resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
});

app.post('/api/get-events', authMiddleware, loggingMiddleware, async (req, resp) => {
    const userId = req.user;
    const date = req.body.date;

    try {
        const db = getDatabase('scholarthynk');
        const collection = db.collection('events');

        if (date.length === 0) {
            return resp.status(400).json({success: false, error: "You cannot request events for an undefined date!"});
        }

        const events = await collection.find({userId: userId, date: date}).toArray();

        resp.status(200).json({success: true, events: events});
    } catch (error) {
        console.error(error);
        logger.error(error);
        resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
});

app.post('/api/delete-event', authMiddleware, loggingMiddleware, async (req, resp) => {
    const userId = req.user;
    const {name, date} = req.body;

    try {
        const db = getDatabase('scholarthynk');
        const collection = db.collection('events');

        if (name.length === 0 || date.length === 0) {
            return resp.status(400).json({success: false, error: "Event name or date cannot be empty!"})
        }

        const eventExists = await collection.findOne({userId: userId, name: name, date: date});

        if (!eventExists) {
            return resp.status(404).json({success: false, error: "The event you are trying to delete was not found!"});
        }

        await collection.deleteOne({userId: userId, name: name, date: date});
        resp.status(200).json({success: true});
    } catch (error) {
        console.error(error);
        logger.error(error);
        resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
});

app.get('/api/get-assignments', authMiddleware, loggingMiddleware, async (req, resp) => {
    const userId = req.user;

    try {
        const db = getDatabase('scholarthynk');
        if (!db) {
            console.error("Database connection failed!");
            logger.error("Get Assignment: Database connection failed!");
            return resp.status(500).json({
                success: false,
                error: "There was an error connecting to the database. Please contact the developer immediately!"
            });
        }

        const collection = db.collection('assignments');
        if (!collection) {
            console.error("Collection 'assignments' not found!");
            logger.error("Get Assignment: Collection 'assignments' not found!");
            return resp.status(500).json({
                success: false,
                error: "There was a database error. Please contact the developer immediately!"
            });
        }

        const assignmentsCursor = await collection.find({userId: userId}, {projection: {userId: 0, _id: 0}});
        if (!assignmentsCursor || typeof assignmentsCursor.toArray !== 'function') {
            console.error("Invalid cursor returned from MongoDB!");
            logger.error("Get Assignment: Invalid cursor returned from MongoDB!");
            return resp.status(500).json({
                success: false,
                error: "There was a database error. Please contact the developer immediately!"
            });
        }

        const assignments = await assignmentsCursor.toArray();

        const currentDate = new Date();

        for (const assignment of assignments) {
            if (assignment.expire != null) {
                const targetTimestamp = assignment.expire;

                const currentDateString = currentDate.toISOString().split('T')[0];

                const targetDate = new Date(targetTimestamp);
                const targetDateString = targetDate.toISOString().split('T')[0];

                if (currentDateString == targetDateString) {
                    await collection.deleteOne({userId: userId, title: assignment.title});
                }
            }
        }

        resp.status(200).json({success: true, assignments: assignments});
    } catch (error) {
        console.error(error);
        logger.error(error);
        resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
});

app.post('/api/add-assignment', authMiddleware, loggingMiddleware, async (req, resp) => {
    const userId = req.user;
    const {title, dueDate, subject, priority, description} = req.body;

    if (!title || !dueDate || !subject || !priority) return resp.status(400).json({
        success: false,
        error: 'Fill out all required fields (title, due date, subject, priority)!'
    });

    try {
        const db = getDatabase('scholarthynk');
        const collection = db.collection('assignments');

        const assignmentExists = await collection.findOne({userId: userId, title: title});
        if (assignmentExists) return resp.status(409).json({
            success: false,
            error: `There already is an assignment with the name ${title}!`
        });

        const assignment = {
            userId: userId,
            title: title,
            dueDate: dueDate,
            subject: subject,
            status: "open",
            priority: priority,
            description: description
        };
        await collection.insertOne(assignment);
        resp.status(200).json({success: true});
    } catch (error) {
        console.error(error);
        logger.error(error);
        resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
});

app.post('/api/update-assignment', authMiddleware, loggingMiddleware, async (req, resp) => {
    const userId = req.user;
    const assignment = req.body.assignment;

    try {
        const db = getDatabase('scholarthynk');
        const collection = db.collection('assignments');

        const currentDate = new Date();

        const updatedAssignment = {
            subject: assignment.subject,
            status: assignment.status,
            priority: assignment.priority,
            description: assignment.description,
            expire: assignment.status === "done" ? new Date().setDate(currentDate.getDate() + 10) : null
        }

        const assignmentExists = await collection.findOne({userId: userId, title: assignment.title});

        if (!assignmentExists) {
            return resp.status(404).json({
                success: false,
                error: "The assigment you are trying to update was not found!"
            });
        }

        await collection.updateOne({userId: userId, title: assignment.title}, {$set: updatedAssignment});
        resp.status(200).json({success: true});
    } catch (error) {
        console.error(error);
        logger.error(error);
        resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
})

app.post('/api/delete-assignment', authMiddleware, loggingMiddleware, async (req, resp) => {
    const userId = req.user;
    const assignment = req.body.assignment;

    try {
        const db = getDatabase('scholarthynk');
        const collection = db.collection('assignments');

        const assignmentExists = await collection.findOne({userId: userId, title: assignment.title});

        if (!assignmentExists) {
            return resp.status(404).json({
                success: false,
                error: "The assigment you are trying to delete was not found!"
            });
        }

        await collection.deleteOne({userId: userId, title: assignment.title});
        resp.status(200).json({success: true});
    } catch (error) {
        console.error(error);
        logger.error(error);
        resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
});

app.post('/api/get-fv-items', authMiddleware, loggingMiddleware, async (req, resp) => {
    const userId = req.user;
    const folder = req.body.folder;
    const path = req.body.path;

    try {
        const db = getDatabase('scholarthynk');
        const collection = db.collection('notes');

        let folders = [];
        let files = [];
        let children = [];

        if (folder === "root") {
            folders = await collection.find({userId: userId, parentFolder: null, type: "folder"}).toArray();
            files = await collection.find({userId: userId, parentFolder: null, type: "note"}).toArray();
        } else {
            const firstFolder = await collection.findOne({
                userId: userId,
                name: path[1],
                parentFolder: null,
                type: "folder"
            });

            if (!firstFolder) {
                return resp.status(200).json({success: true, folders: [], files: []});
            }

            let pathIndex = 2;
            let currentFolder = firstFolder;

            while (pathIndex < path.length && currentFolder.children.length > 0) {
                let nextFolderID = "";

                for (const child of currentFolder.children) {
                    const folder = await collection.findOne({userId: userId, _id: child});

                    if (folder.name === path[pathIndex]) {
                        nextFolderID = folder._id;
                        break;
                    }
                }

                if (nextFolderID) {
                    currentFolder = await collection.findOne({userId: userId, _id: nextFolderID, type: "folder"});
                    pathIndex++;
                } else {
                    break;
                }
            }

            for (const child of currentFolder.children) {
                const item = await collection.findOne({userId: userId, _id: child});
                children.push(item);
            }
        }

        children.forEach(item => {
            if (item.type === "folder") {
                folders.push(item);
            } else {
                files.push(item);
            }
        });

        folders.forEach(folder => {
            const date = folder.lastEdited;
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            folder.lastEdited = `${day}.${month}.${year}`;
        });

        files.forEach(file => {
            const date = file.lastEdited;
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            file.lastEdited = `${day}.${month}.${year}`;
        });

        resp.status(200).json({success: true, folders: folders, files: files});
    } catch (error) {
        console.error(error);
        logger.error(error);
        resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
});

app.post('/api/create-folder', authMiddleware, loggingMiddleware, async (req, resp) => {
    const userId = req.user;
    const parentPath = req.body.folder;
    const folderName = req.body.name;

    try {
        const db = getDatabase('scholarthynk');
        const collection = db.collection('notes');

        if (folderName.length === 0) {
            return resp.status(400).json({success: false, error: 'Folder name cannot be empty!'});
        }

        if (folderName === "root") {
            return resp.status(400).json({success: false, error: "Folder cannot be named 'root'!"});
        }

        // Get Parent FolderID
        // parentPath = ["root", "folder1", "folder2"]

        let folderIds = [];

        for (const folder of parentPath) {
            if (folder !== "root") {
                const id = await collection.findOne({
                    userId: userId,
                    type: "folder",
                    parentFolder: folder === "root" ? null : folderIds[folderIds.length - 1]
                });

                folderIds.push(id._id);
            }
        }

        const parentFolderId = folderIds[folderIds.length - 1];
        const parentFolder = await collection.findOne({userId: userId, _id: parentFolderId});

        // Check if folder already exists
        const folderExists = await collection.findOne({userId: userId, name: folderName, parentFolder: parentFolderId});

        if (folderExists) {
            return resp.status(409).json({success: false, error: 'Folder already exists!'});
        }

        // Create Folder
        const newFolder = {
            name: folderName,
            userId: userId,
            parentFolder: parentFolder ? parentFolderId : null,
            type: "folder",
            lastEdited: new Date(),
            children: []
        };

        await collection.insertOne(newFolder);

        if (parentFolder !== null) {
            await collection.updateOne(
                {userId: userId, _id: newFolder.parentFolder},
                {$push: {children: newFolder._id}}
            );
        }

        return resp.status(200).json({success: true});
    } catch (error) {
        console.error(error);
        logger.error(error);
        return resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
});

app.post('/api/rename-fv-item', authMiddleware, loggingMiddleware, async (req, resp) => {
    const userId = req.user;
    const itemName = req.body.oldName;
    const newName = req.body.newName;
    const parentPath = req.body.path;

    try {
        const db = getDatabase('scholarthynk');
        const collection = db.collection('notes');

        if (newName === "root") {
            return resp.status(400).json({success: false, error: "Item cannot be named root!"});
        }

        let folderIds = [];
        let currentFolder = null;

        for (let i = 1; i < parentPath.length; i++) {
            const parentId = i === 1 ? null : folderIds[i - 2];

            currentFolder = await collection.findOne({
                userId: userId,
                name: parentPath[i],
                parentFolder: parentId,
                type: "folder"
            });

            if (!currentFolder) {
                return resp.status(404).json({success: false, error: `Folder "${parentPath[i]}" not found in path!`});
            }

            folderIds.push(currentFolder._id);
        }

        const parentFolderId = folderIds.length > 0 ? folderIds[folderIds.length - 1] : null;

        const item = await collection.findOne({
            userId: userId,
            name: itemName,
            parentFolder: parentFolderId
        });

        if (!item) {
            return resp.status(404).json({
                success: false,
                error: `The item with the name '${itemName} was nat found'!`
            });
        }

        const existingItem = await collection.findOne({
            userId: userId,
            name: newName,
            parentFolder: parentFolderId
        });

        if (existingItem) {
            return resp.status(400).json({
                success: false,
                error: "An item with this name already exists in this folder!"
            });
        }

        await collection.updateOne(
            {_id: item._id},
            {$set: {name: newName}}
        );

        return resp.status(200).json({success: true});
    } catch (error) {
        console.error(error);
        logger.error(error);
        resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
});

app.post('/api/delete-fv-items', authMiddleware, loggingMiddleware, async (req, resp) => {
    const userId = req.user;
    const path = req.body.path;
    const itemName = req.body.folder;

    try {
        const db = getDatabase('scholarthynk');
        const collection = db.collection('notes');

        if (itemName === "root") {
            return resp.status(400).json({success: false, error: "You cannot delete the root folder!"});
        }

        let folderIds = [];
        let currentFolder = null;

        for (let i = 1; i < path.length; i++) {
            const parentId = i === 1 ? null : folderIds[i - 2];

            currentFolder = await collection.findOne({
                userId: userId,
                name: path[i],
                parentFolder: parentId,
                type: "folder"
            });

            if (!currentFolder) {
                return resp.status(404).json({success: false, error: `The item "${path[i]}" was not found!`});
            }

            folderIds.push(currentFolder._id);
        }

        const targetItem = await collection.findOne({
            userId: userId,
            name: itemName,
            parentFolder: currentFolder ? currentFolder._id : null
        });

        if (!targetItem) {
            return resp.status(404).json({success: false, error: "The item you want to delete was not found!"});
        }

        if (targetItem.type === "note") {
            await collection.deleteOne({userId: userId, _id: targetItem._id});

            if (targetItem.parentFolder) {
                await collection.updateOne(
                    {userId: userId, _id: targetItem.parentFolder},
                    {$pull: {children: targetItem._id}}
                );
            }

            return resp.status(200).json({success: true});
        }

        /**
         * Recursively deletes a folder and all its children.
         * @param {string} folderId The id of the folder to delete.
         * @returns {Promise<void>}
         */
        async function deleteFolderRecursive(folderId) {
            const folder = await collection.findOne({userId: userId, _id: folderId});
            if (!folder) return;

            if (folder.children && folder.children.length > 0) {
                for (const childId of folder.children) {
                    const child = await collection.findOne({userId: userId, _id: childId});
                    if (child) {
                        if (child.type === "folder") {
                            await deleteFolderRecursive(childId);
                        } else {
                            await collection.deleteOne({userId: userId, _id: childId});
                        }
                    }
                }
            }

            if (folder.parentFolder) {
                await collection.updateOne(
                    {userId: userId, _id: folder.parentFolder},
                    {$pull: {children: folderId}}
                );
            }

            await collection.deleteOne({userId: userId, _id: folderId});
        }

        await deleteFolderRecursive(targetItem._id);
        resp.status(200).json({success: true});
    } catch (error) {
        console.error(error);
        logger.error(error);
        resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
});

app.post('/api/get-note', authMiddleware, loggingMiddleware, async (req, resp) => {
    const noteTitle = req.body.title;
    const parentPath = req.body.path;
    const userId = req.user;

    try {
        const db = getDatabase('scholarthynk');
        const collection = db.collection('notes');

        let folderIds = [];

        for (const folder of parentPath) {
            if (folder !== "root") {
                const id = await collection.findOne({
                    userId: userId,
                    type: "folder",
                    parentFolder: folder === "root" ? null : folderIds[folderIds.length - 1]
                });
                folderIds.push(id._id);
            }
        }

        let note = null;

        if (parentPath.length !== 1 && parentPath[0] !== "root") {
            note = await collection.findOne({
                userId: userId,
                name: noteTitle,
                parentFolder: folderIds[folderIds.length - 1],
                type: "note"
            });
        } else {
            note = await collection.findOne({userId: userId, name: noteTitle, parentFolder: null, type: "note"});
        }

        if (!note) {
            return resp.status(404).json({success: false, error: 'Your note was not found!'});
        }

        return resp.status(200).json({success: true, note: note});
    } catch (error) {
        console.error(error);
        logger.error(error);
        resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
});

app.post('/api/new-note', authMiddleware, loggingMiddleware, async (req, resp) => {
    const userId = req.user;
    const parentPath = req.body.path;

    try {
        const db = getDatabase('scholarthynk');
        const collection = db.collection('notes');

        let folderIds = [];

        for (const folder of parentPath) {
            if (folder !== "root") {
                const id = await collection.findOne({
                    userId: userId,
                    type: "folder",
                    parentFolder: folder === "root" ? null : folderIds[folderIds.length - 1]
                });
                folderIds.push(id._id);
            }
        }

        const parentFolderId = folderIds[folderIds.length - 1];
        const parentFolder = await collection.findOne({userId: userId, _id: parentFolderId});

        const newNote = {
            name: "Untitled",
            userId: userId,
            parentFolder: parentFolder ? parentFolderId : null,
            type: "note",
            lastEdited: new Date(),
            children: [],
            fileContent: ""
        };

        await collection.insertOne(newNote);

        if (parentFolder !== null) {
            await collection.updateOne(
                {userId: userId, _id: newNote.parentFolder},
                {$push: {children: newNote._id}}
            );
        }

        return resp.status(200).json({success: true});
    } catch (error) {
        console.error(error);
        logger.error(error);
        resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
});

app.post('/api/update-note', authMiddleware, loggingMiddleware, async (req, resp) => {
    const noteTitle = req.body.title;
    const oldNoteTitle = req.body.oldTitle;
    const noteContent = req.body.content;
    const parentPath = req.body.path;
    const userId = req.user;

    try {
        const db = getDatabase('scholarthynk');
        const collection = db.collection('notes');

        if (noteTitle === "root") {
            resp.status(400).json({success: false, error: "You cannot name the note 'root'!"});
        }

        let folderIds = [];

        for (const folder of parentPath) {
            if (folder !== "root") {
                const id = await collection.findOne({
                    userId: userId,
                    type: "folder",
                    parentFolder: folder === "root" ? null : folderIds[folderIds.length - 1]
                });
                folderIds.push(id._id);
            }
        }

        let note = null;

        if (parentPath.length !== 1 && parentPath[0] !== "root") {
            note = await collection.findOne({
                userId: userId,
                name: oldNoteTitle,
                parentFolder: folderIds[folderIds.length - 1],
                type: "note"
            });
        } else {
            note = await collection.findOne({userId: userId, name: oldNoteTitle, parentFolder: null, type: "note"});
        }

        if (!note) {
            return resp.status(404).json({success: false, error: 'Note not found!'});
        }

        await collection.updateOne(
            {userId: userId, _id: note._id},
            {$set: {fileContent: noteContent, name: noteTitle, lastEdited: new Date()}}
        );

        return resp.status(200).json({success: true});
    } catch (error) {
        console.error(error);
        logger.error(error);
        resp.status(500).json({
            success: false,
            error: "There was an internal server error! Please try again. If this keeps occuring please contact the developer!"
        });
    }
});

/**
 * Generates an authorization token for the given user ID.
 * The token is signed with the `secretKey` and expires in 7 days.
 * @param {string} userId - The user ID to generate the token for.
 * @returns {string} The generated authorization token.
 */
function generateAuthToken(userId) {
    return jwt.sign({userId}, secretKey, {expiresIn: '7d'});
}

/**
 * Verifies a given authorization token and returns the payload if valid.
 * If the token is invalid, it returns null.
 * @param {string} token - The authorization token to verify.
 * @returns {Object|null} The payload of the token if it is valid, null otherwise.
 */
function verifyAuthToken(token) {
    try {
        return jwt.verify(token, secretKey);
    } catch (error) {
        return null;
    }
}

/**
 * Generates a unique user ID.
 * @returns {string} A unique user ID.
 */
function generateUserId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    logger.info(`Server running on port ${port}`);
});