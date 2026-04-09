const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000;
const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');
const dataDir = path.join(rootDir, 'data');
const dbPath = path.join(dataDir, 'exam-db.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ uploads: [] }, null, 2));
}

const loadDb = () => JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const saveDb = (db) => {
  fs.writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`);
};

const sanitizeDownloadName = (name) =>
  path.basename(String(name || 'exam-file')).replace(/[^a-zA-Z0-9._-]/g, '_');

const getCredentials = () => ({
  username: process.env.EXAM_APP_USERNAME || 'admin',
  password: process.env.EXAM_APP_PASSWORD || 'exam1234',
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'exam-upload-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
    },
  })
);
app.use(express.static(publicDir));

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Login is required before uploading exams.' });
  }

  return next();
};

app.get('/api/session', (req, res) => {
  if (!req.session.user) {
    return res.json({ authenticated: false });
  }

  return res.json({
    authenticated: true,
    user: req.session.user,
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const credentials = getCredentials();

  if (username !== credentials.username || password !== credentials.password) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  req.session.user = { username };

  return res.json({
    authenticated: true,
    user: req.session.user,
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    return res.json({ authenticated: false });
  });
});

app.get('/api/uploads', requireAuth, (_req, res) => {
  const db = loadDb();
  const uploads = db.uploads
    .slice(0, 10)
    .map(({ contentBase64, ...uploadRecord }) => uploadRecord);

  return res.json({ uploads });
});

app.get('/api/uploads/:id/download', requireAuth, (req, res) => {
  const db = loadDb();
  const uploadRecord = db.uploads.find((entry) => entry.id === req.params.id);

  if (!uploadRecord) {
    return res.status(404).json({ error: 'Uploaded exam not found.' });
  }

  const buffer = Buffer.from(uploadRecord.contentBase64, 'base64');

  res.setHeader('Content-Type', uploadRecord.mimeType || 'application/octet-stream');
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Content-Disposition', `attachment; filename="${sanitizeDownloadName(uploadRecord.originalName)}"`);

  return res.send(buffer);
});

app.post('/api/upload', requireAuth, upload.single('examFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please select a file to upload.' });
  }

  const db = loadDb();
  const uploadRecord = {
    id: crypto.randomUUID(),
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: req.session.user.username,
    contentBase64: req.file.buffer.toString('base64'),
  };

  db.uploads.unshift(uploadRecord);
  saveDb(db);

  return res.json({
    message: 'Exam uploaded successfully.',
    file: {
      id: uploadRecord.id,
      name: uploadRecord.originalName,
      size: uploadRecord.size,
      uploadedAt: uploadRecord.uploadedAt,
      uploadedBy: uploadRecord.uploadedBy,
    },
  });
});

app.listen(port, () => {
  console.log(`Exam upload app running on http://localhost:${port}`);
});