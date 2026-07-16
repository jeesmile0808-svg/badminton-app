// เก็บข้อมูล 2 แบบ:
// 1) ถ้าตั้งค่า UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN ไว้ -> เก็บถาวรบน Upstash Redis (ฟรี)
// 2) ถ้าไม่ได้ตั้งค่า -> เก็บในไฟล์ JSON local (data/state.json, data/roster.json) เหมือนเดิม
//    ข้อควรระวัง: ถ้า deploy บน Render แผนฟรี ไฟล์ local จะหายทุกครั้งที่แอป sleep แล้วตื่นใหม่
//    (แผนฟรีของ Render ไม่มีดิสก์ถาวร) แนะนำให้ตั้งค่า Upstash เพื่อไม่ให้ข้อมูลหาย
//
// หมายเหตุการเรียก Upstash: ใช้รูปแบบ "JSON array command body" ตามเอกสารทางการ
// (POST ไปที่ endpoint ตรงๆ พร้อม body เป็น ["SET","key","value"] หรือ ["GET","key"])
// เพราะปลอดภัยกว่าการฝังค่าลงใน URL path เมื่อค่าที่เก็บเป็น JSON ยาวๆ ที่มีอักขระพิเศษ/ภาษาไทย
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const STATE_FILE = path.join(__dirname, '..', 'data', 'state.json');
const ROSTER_FILE = path.join(__dirname, '..', 'data', 'roster.json');

const ROSTER_KEY = 'badminton:roster';
const STATE_KEY = 'badminton:state';

const DEFAULT_CONFIG = { shuttleUnitPrice: 78, shuttlesUsed: 12, courtHourlyRate: 180, hours: 6.5 };

function upstashConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstashCommand(commandArray) {
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commandArray),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upstash error ${res.status}: ${errText}`);
  }
  return res.json();
}

async function upstashGet(key) {
  const data = await upstashCommand(['GET', key]);
  if (!data || data.result === null || data.result === undefined) return null;
  try {
    return JSON.parse(data.result);
  } catch (e) {
    // ข้อมูลที่เก็บไว้เสีย/อ่านไม่ได้ (เช่นจากบั๊กเวอร์ชันเก่า) ถือว่าไม่มีข้อมูล ให้ผู้เรียกไปสร้างค่าใหม่แทน
    return null;
  }
}

async function upstashSet(key, value) {
  await upstashCommand(['SET', key, JSON.stringify(value)]);
}

function isValidRoster(roster) {
  return !!(roster && Array.isArray(roster.players) && roster.players.length > 0);
}

async function loadRoster() {
  if (upstashConfigured()) {
    let roster = await upstashGet(ROSTER_KEY);
    if (!isValidRoster(roster)) {
      // ยังไม่เคยบันทึกขึ้น Upstash มาก่อน (หรือข้อมูลเสีย) ใช้ค่าตั้งต้นจากไฟล์ที่แถมมาเป็นฐาน แล้วเซฟขึ้นไปใหม่
      roster = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8'));
      if (!roster.config) roster.config = DEFAULT_CONFIG;
      await upstashSet(ROSTER_KEY, roster);
    }
    if (!roster.config) roster.config = DEFAULT_CONFIG;
    return roster;
  }
  const roster = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8'));
  if (!roster.config) roster.config = DEFAULT_CONFIG;
  return roster;
}

async function saveRoster(roster) {
  if (upstashConfigured()) {
    await upstashSet(ROSTER_KEY, roster);
    return;
  }
  fs.writeFileSync(ROSTER_FILE, JSON.stringify(roster, null, 2), 'utf8');
}

function freshState(roster) {
  const players = {};
  roster.players.forEach((name) => {
    players[name] = { online: false, games: 0 };
  });
  return {
    date: new Date().toISOString().slice(0, 10),
    config: roster.config,
    players,
    updatedAt: new Date().toISOString(),
  };
}

async function defaultState() {
  const roster = await loadRoster();
  return freshState(roster);
}

// แปลงข้อมูลรูปแบบเก่า (attendance แบบ session 1/2/3) ให้เป็นรูปแบบใหม่ (online + games)
function migrateState(state, roster) {
  if (state && state.players) return state; // เป็นรูปแบบใหม่อยู่แล้ว
  const players = {};
  roster.players.forEach((name) => {
    const old = state && state.attendance && state.attendance[name];
    const wasOnline = old && Object.values(old).some(Boolean);
    players[name] = { online: !!wasOnline, games: 0 };
  });
  return {
    date: (state && state.date) || new Date().toISOString().slice(0, 10),
    config: roster.config,
    players,
    updatedAt: new Date().toISOString(),
  };
}

function isValidState(state) {
  return !!(state && state.players && typeof state.players === 'object');
}

async function loadState() {
  const roster = await loadRoster();
  let raw;

  if (upstashConfigured()) {
    raw = await upstashGet(STATE_KEY);
    if (!raw) {
      const state = freshState(roster);
      await saveState(state);
      return state;
    }
  } else {
    if (!fs.existsSync(STATE_FILE)) {
      const state = freshState(roster);
      await saveState(state);
      return state;
    }
    raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }

  let migrated = migrateState(raw, roster);
  if (!isValidState(migrated)) {
    // ข้อมูลเสีย/รูปแบบไม่ถูกต้อง กู้กลับเป็นค่าเริ่มต้นแทนการพังทั้งหน้า
    migrated = freshState(roster);
    await saveState(migrated);
    return migrated;
  }
  if (!migrated.config) migrated.config = roster.config;
  roster.players.forEach((name) => {
    if (!migrated.players[name]) migrated.players[name] = { online: false, games: 0 };
  });
  return migrated;
}

async function saveState(state) {
  state.updatedAt = new Date().toISOString();
  if (upstashConfigured()) {
    await upstashSet(STATE_KEY, state);
  } else {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  }
  return state;
}

module.exports = { loadRoster, saveRoster, loadState, saveState, defaultState, upstashConfigured };
