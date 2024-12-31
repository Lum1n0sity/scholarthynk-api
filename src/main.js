const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());

const secretKey = process.env.SECRET_KEY;

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected...'))
  .catch(err => console.log(err));

function getDatabase(dbName) {
  return mongoose.connection.useDb(dbName, { useCache: true });
}

// * Example endpoint
/**
app.get('/:dbName/collection/:collectionName', async (req, res) => {
  const { dbName, collectionName } = req.params;

  try {
    // Get the specific database
    const db = getDatabase(dbName);

    // Access a collection within that database
    const collection = db.collection(collectionName);

    // Perform an operation, e.g., find all documents
    const documents = await collection.find({}).toArray();

    res.json({ success: true, data: documents });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});
**/

app.get('/', async (req, resp) => {
  resp.send('Hello World');
});

app.post('/api/signup', async (req, resp) => {
  const { name, email, password, remember } = req.body;
  const saltRounds = 12;

  try {
    const db = getDatabase('scholarthynk');
    const collection = db.collection('users');

    if (name && email && password && await collection.findOne({ email: email}) == null) {
      const userId = generateUserId();
      const authToken = remember ? generateAuthToken(userId) : null;
      const hash = await bcrypt.hash(password, saltRounds);
      collection.insertOne({ userId: userId, name: name, email: email, password: hash, createdAt: new Date() });
      resp.json({ success: true, authToken: authToken });
    } else {
      resp.status(409).json({ success: false, error: 'User already exists!' });
    }
  } catch (error) {
    console.error(error);
    resp.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/login', async (req, resp) => {
  const { email, password, remember } = req.body;

  try {
    const db = getDatabase('scholarthynk');
    const collection = db.collection('users');

    const user = await collection.findOne({ email: email });
    if (!user) return resp.status(401).json({ success: false, error: 'Invalid credentials!' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return resp.status(401).json({ success: false, error: 'Invalid credentials!' });

    const token = generateAuthToken(user.userId);
    resp.json({ success: true, authToken: token });
  } catch (error) {
    console.error(error);
    resp.status(500).json({ success: false, error: error.message });
  }
});

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'Unauthorized!' });

  const payload = verifyAuthToken(token);
  if (!payload) return res.status(401).json({ success: false, error: 'Unauthorized!' });

  req.user = payload.userId;
  next();
};

app.get('/api/auth', authMiddleware, async (req, resp) => {
  resp.json({ success: true, userId: req.user });
});

function generateAuthToken(userId) {
  return jwt.sign({ userId }, secretKey, { expiresIn: '7d' });
}

function verifyAuthToken(token) {
  try {
    return jwt.verify(token, secretKey);
  } catch (error) {
    return null;
  }
}

function generateUserId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});