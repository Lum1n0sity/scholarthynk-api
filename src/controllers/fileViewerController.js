const logger = require("../config/logger");
const {Note} = require("../models/Note");

const getFVItems = async (req, resp) => {
    const userId = req.user;
    const {path, folder} = req.body;

    try {
        let folders = [];
        let files = [];
        let children = [];

        if (!path || !folder) return resp.status(400).json({success: false, error: "Folder and path are required!"});

        if (folder === "root") {
            folders = await Note.find({userId: userId, parentFolder: null, type: "folder"}).lean();
            files = await Note.find({userId: userId, parentFolder: null, type: "note"}).lean();
        } else {
            const firstFolder = await Note.findOne({userId: userId, name: path[1], parentFolder: null, type: "folder"});

            if (!firstFolder) return resp.status(200).json({folders: folders, files: files});

            let pathIndex = 2;
            let currentFolder = firstFolder;

            while (pathIndex < path.length && currentFolder.children.length > 0) {
                let nextFolderId = "";

                for (const child of currentFolder.children) {
                    const folder = await Note.findOne({userId: userId, _id: child});

                    if (folder.name === path[pathIndex]) {
                        nextFolderId = folder._id;
                        break;
                    }
                }

                if (nextFolderId) {
                    currentFolder = await Note.findOne({userId: userId, _id: nextFolderId, type: "folder"});
                    pathIndex++;
                } else {
                    break;
                }
            }

            for (const child of currentFolder.children) {
                const item = await Note.findOne({userId: userId, _id: child});
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
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

const newFolder = async (req, resp) => {
    const userId = req.user;
    const parentPath = req.body.parentPath;
    const folderName = req.body.folderName;

    try {
        if (folderName.length === 0) return resp.status(400).json({
            success: false,
            error: "Folder name cannot be empty!"
        });

        if (folderName === "root") return resp.status(400).json({
            success: false,
            error: "Folder cannot be named 'root'!"
        });

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

        const folderExists = await Note.findOne({
            userId: userId,
            name: folderName,
            parentFolder: parentFolder,
            type: "folder"
        });

        if (folderExists) return resp.status(409).json({success: false, error: "Folder already exists!"});

        const newFolder = new Note({
            userId: userId,
            name: folderName,
            parentFolder: parentFolder,
            type: "folder"
        });

        await newFolder.save();

        if (parentFolder !== null) {
            await Note.updateOne(
                {userId: userId, _id: newFolder.parentFolder},
                {$push: {children: newFolder._id}}
            );
        }

        return resp.status(200).json({success: true});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

const renameFVItem = async (req, resp) => {
    const userId = req.user;
    const itemName = req.body.oldName;
    const newName = req.body.newName;
    const parentPath = req.body.path;

    try {
        if (newName === "root") return resp.status(400).json({success: false, error: "Item cannot be named root!"});

        let folderIds = [];
        let currentFolder = null;

        for (let i = 1; i < parentPath.length; i++) {
            const parentId = i === 1 ? null : folderIds[i - 2];

            currentFolder = await Note.findOne({
                userId: userId,
                name: parentPath[i],
                parentFolder: parentId,
                type: "folder"
            });

            if (!currentFolder) return resp.status(404).json({
                success: false,
                error: `Folder "${parentPath[i]}" not found in path!`
            });

            folderIds.push(currentFolder._id);
        }

        const parentFolderId = folderIds.length > 0 ? folderIds[folderIds.length - 1] : null;

        const item = await Note.findOne({userId: userId, name: itemName, parentFolder: parentFolderId});

        if (!item) return resp.status(404).json({success: false, error: `Item "${itemName}" not found in path!`});

        const itemExists = await Note.findOne({userId: userId, name: newName, parentFolder: parentFolderId});

        if (itemExists) return resp.status(409).json({success: false, error: "Item already exists!"});

        await Note.updateOne(
            {_id: item._id},
            {$set: {name: newName}}
        );

        return resp.status(200).json({success: true});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
}

const deleteFVItem = async (req, resp) => {
    const userId = req.user;
    const path = req.body.path;
    const itemName = req.body.folder;

    try {
        if (itemName === "root") return resp.status(400).json({
            success: false,
            error: "You cannot delete the root folder!"
        });

        let folderIds = [];
        let currentFolder = null;

        for (let i = 1; i < path.length; i++) {
            const parentId = i === 1 ? null : folderIds[i - 2];

            currentFolder = await Note.findOne({userId: userId, name: path[i], parentFolder: parentId, type: "folder"});

            if (!currentFolder) return resp.status(404).json({
                success: false,
                error: `The item "${path[i]}" was not found!`
            });

            folderIds.push(currentFolder._id);
        }

        const targetItem = await Note.findOne({
            userId: userId,
            name: itemName,
            parentFolder: currentFolder ? currentFolder._id : null
        });

        if (!targetItem) return resp.status(404).json({error: "The item you want to delete was not found!"});

        if (targetItem.type === "note") {
            await Note.deleteOne({userId: userId, _id: targetItem._id});

            if (targetItem.parentFolder !== null) {
                await Note.updateOne(
                    {userId: userId, _id: targetItem.parentFolder},
                    {$pull: {children: targetItem._id}}
                );
            }

            return resp.status(200).json({success: true});
        }

        /**
         * Recursively deletes a folder and all its children from the database.
         * If the folder has any children, it will delete them as well,
         * traversing down the hierarchy until all subfolders and notes are removed.
         * Updates the parent folder to remove the reference to the deleted folder.
         *
         * @param {string} folderId - The ID of the folder to delete.
         * @returns {Promise<void>}
         */
        async function deleteFolderRecursively(folderId) {
            const folder = await Note.findOne({userId: userId, _id: folderId});
            if (!folder) return;

            if (folder.children && folder.children.length > 0) {
                for (const childId of folder.children) {
                    const child = await Note.findOne({userId: userId, _id: childId});

                    if (child) {
                        if (child.type === "folder") {
                            await deleteFolderRecursively(childId);
                        } else {
                            await Note.deleteOne({userId: userId, _id: childId});
                        }
                    }
                }
            }

            if (folder.parentFolder !== null) {
                await Note.updateOne(
                    {userId: userId, _id: folder.parentFolder},
                    {$pull: {children: folder._id}}
                );
            }

            await Note.deleteOne({userId: userId, _id: folderId});
        }

        await deleteFolderRecursively(targetItem._id);

        resp.status(200).json({success: true});
    } catch (err) {
        logger.error(err);
        resp.status(500).json({error: "There was an internal server error! Please try again! If this error keeps occurring, please contact the developer!"});
    }
};

module.exports = {getFVItems, newFolder, renameFVItem, deleteFVItem};