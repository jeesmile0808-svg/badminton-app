// Sync ตารางเข้าร่วมไปยัง Google Sheet ของผู้ใช้ (ไม่บังคับ ใช้ได้เมื่อตั้งค่า service account แล้ว)
const { google } = require('googleapis');

function isConfigured() {
  return !!(process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

async function getSheetsClient() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

// เขียนตารางสรุปรายชื่อ ให้มีโครงคล้ายภาพต้นฉบับ: หัวข้อสนาม/เวลา แล้วตามด้วยรายชื่อ + เครื่องหมายถูก
async function syncState(state, roster) {
  if (!isConfigured()) return { skipped: true, reason: 'Google Sheets ยังไม่ได้ตั้งค่า' };

  const sheets = await getSheetsClient();
  const tab = process.env.GOOGLE_SHEET_TAB || 'Sheet1';

  const rows = [];
  rows.push([`สรุปรายชื่อสมาชิก วันที่ ${state.date}`]);
  roster.sessions.forEach((s) => {
    rows.push([`${s.label} : ${s.time}`]);
  });
  rows.push([]);
  rows.push(['#', 'ชื่อ', ...roster.sessions.map((s) => `สนาม ${s.id}`)]);

  roster.players.forEach((name, idx) => {
    const att = state.attendance[name] || {};
    rows.push([
      idx + 1,
      name,
      ...roster.sessions.map((s) => (att[s.id] ? '✓' : '')),
    ]);
  });

  const totals = roster.sessions.map(
    (s) => roster.players.filter((name) => state.attendance[name] && state.attendance[name][s.id]).length
  );
  rows.push([]);
  rows.push(['รวม', '', ...totals]);

  await sheets.spreadsheets.values.clear({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${tab}!A1:Z200`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${tab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  return { skipped: false };
}

module.exports = { isConfigured, syncState };
