// เก็บข้อมูลแบบง่ายในไฟล์ JSON local (data/state.json)
// ถ้าตั้งค่า Google Sheets ไว้ จะ sync ไปที่ชีตด้วยทุกครั้งที่ save
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'data', 'state.json');
const ROSTER_FILE = path.join(__dirname, '..', 'data', 'roster.json');

function loadRoster() {
  return JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8'));
}

function saveRoster(roster) {
  fs.writeFileSync(ROSTER_FILE, JSON.stringify(roster, null, 2), 'utf8');
}

function defaultState() {
  const roster = loadRoster();
  const attendance = {};
  roster.players.forEach((name) => {
    attendance[name] = { 1: false, 2: false, 3: false };
  });
  return {
    date: new Date().toISOString().slice(0, 10),
    attendance,
    updatedAt: new Date().toISOString(),
  };
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    const state = defaultState();
    saveState(state);
    return state;
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(state) {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  return state;
}

module.exports = { loadRoster, saveRoster, loadState, saveState, defaultState };
