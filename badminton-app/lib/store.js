// เก็บข้อมูลแบบง่ายในไฟล์ JSON local (data/state.json)
// หมายเหตุ: ถ้า deploy บน Render แผนฟรี ไฟล์นี้จะรีเซ็ตทุกครั้งที่ deploy ใหม่ (ดิสก์ไม่ถาวร)
// ถ้าต้องการเก็บถาวร แนะนำให้กด "Sync ไป Google Sheet" หลังใช้งานทุกครั้ง
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'data', 'state.json');
const ROSTER_FILE = path.join(__dirname, '..', 'data', 'roster.json');

function loadRoster() {
  const roster = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8'));
  if (!roster.config) {
    roster.config = { shuttleUnitPrice: 78, shuttlesUsed: 12, courtHourlyRate: 180, hours: 6.5 };
  }
  return roster;
}

function saveRoster(roster) {
  fs.writeFileSync(ROSTER_FILE, JSON.stringify(roster, null, 2), 'utf8');
}

function defaultState() {
  const roster = loadRoster();
  const players = {};
  roster.players.forEach((name) => {
    players[name] = { online: false, games: 0, onCourt: false };
  });
  return {
    date: new Date().toISOString().slice(0, 10),
    config: roster.config,
    players,
    updatedAt: new Date().toISOString(),
  };
}

// แปลงข้อมูลรูปแบบเก่า (attendance แบบ session 1/2/3) ให้เป็นรูปแบบใหม่ (online + games)
function migrateState(state, roster) {
  if (state && state.players) return state; // เป็นรูปแบบใหม่อยู่แล้ว
  const players = {};
  roster.players.forEach((name) => {
    const old = state && state.attendance && state.attendance[name];
    const wasOnline = old && Object.values(old).some(Boolean);
    players[name] = { online: !!wasOnline, games: 0, onCourt: false };
  });
  return {
    date: (state && state.date) || new Date().toISOString().slice(0, 10),
    config: roster.config,
    players,
    updatedAt: new Date().toISOString(),
  };
}

function loadState() {
  const roster = loadRoster();
  if (!fs.existsSync(STATE_FILE)) {
    const state = defaultState();
    saveState(state);
    return state;
  }
  const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  const migrated = migrateState(raw, roster);
  if (!migrated.config) migrated.config = roster.config;
  // เติมผู้เล่นใหม่ที่มีใน roster แต่ยังไม่มีใน state (เช่น เพิ่งเพิ่มชื่อ)
  roster.players.forEach((name) => {
    if (!migrated.players[name]) migrated.players[name] = { online: false, games: 0, onCourt: false };
  });
  return migrated;
}

function saveState(state) {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  return state;
}

module.exports = { loadRoster, saveRoster, loadState, saveState, defaultState };
