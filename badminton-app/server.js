require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');

const { requireAuth } = require('./lib/auth');
const { loadRoster, saveRoster, loadState, saveState, defaultState } = require('./lib/store');
const { parseAttendance } = require('./lib/parser');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

app.use(express.json({ limit: '10mb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }, // 7 วัน
  })
);

// ---- Auth ----
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  const groupPassword = process.env.GROUP_PASSWORD;
  if (!groupPassword) {
    return res.status(500).json({ error: 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า GROUP_PASSWORD' });
  }
  if (password === groupPassword) {
    req.session.loggedIn = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// login.html เปิดได้เสมอ (ไม่ต้อง auth)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.get('/', (req, res) => {
  if (req.session && req.session.loggedIn) {
    return res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  }
  return res.redirect('/login.html');
});

// ---- ป้องกันทุกอย่างหลังจากนี้ด้วย auth ----
app.use(requireAuth);

app.get('/api/state', (req, res) => {
  res.json({ state: loadState(), roster: loadRoster() });
});

app.post('/api/state', (req, res) => {
  const state = saveState(req.body.state);
  res.json({ ok: true, state });
});

app.post('/api/state/reset', (req, res) => {
  const state = saveState(defaultState());
  res.json({ ok: true, state });
});

app.get('/api/roster', (req, res) => {
  res.json(loadRoster());
});

app.post('/api/roster', (req, res) => {
  saveRoster(req.body);
  res.json({ ok: true });
});

// ---- AI parse: ข้อความ และ/หรือ ภาพ ----
app.post('/api/parse', upload.single('image'), async (req, res) => {
  try {
    const roster = loadRoster();
    const text = req.body.text || '';
    let imageBase64, imageMediaType;
    if (req.file) {
      imageBase64 = req.file.buffer.toString('base64');
      imageMediaType = req.file.mimetype;
    }
    const result = await parseAttendance({ text, imageBase64, imageMediaType, roster });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Badminton attendance app running on http://localhost:${PORT}`));
