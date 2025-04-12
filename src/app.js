const express = require("express");
const cors = require('cors');
const app = express();

const connectDB = require("./config/dbConfig");

const authMiddleware = require("./middleware/authMiddleware");
const loggingMiddleware = require("./middleware/loggingMiddleware");

const userRoutes = require("./routes/userRoutes");
const profilePictureRoutes = require("./routes/profilePictureRoutes");
const eventRoutes = require("./routes/eventRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const noteRoutes = require("./routes/noteRoutes");
const fileViewerRoutes = require("./routes/fileViewerRoutes");
const adminRoutes = require("./routes/adminRoutes");

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(loggingMiddleware);

// DB connection
connectDB();

// Routes
app.use('/api/user', userRoutes);

app.use(authMiddleware);
app.use('/api/profilePic', profilePictureRoutes);
app.use('/api/event', eventRoutes);
app.use('/api/assignment', assignmentRoutes);
app.use('/api/note', noteRoutes);
app.use('/api/fileViewer', fileViewerRoutes);
app.use('/api/admin', adminRoutes);

module.exports = app;