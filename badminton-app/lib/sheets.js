// Sync ตารางเข้าร่วม+ค่าใช้จ่ายไปยัง Google Sheet ของผู้ใช้ (ไม่บังคับ ใช้ได้เมื่อตั้งค่า service account แล้ว)
const { google } = require('googleapis');
const { computeTotals } = require('./calc');

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

// เขียนตารางแบบเดียวกับ "ตารางคำนวณ" ต้นฉบับ: รายชื่อ / รายจ่ายต่อคน / ออนไลน์ / จำนวนเกมส์ / ค่าสนาม / ค่าลูก
// พร้อมสรุปยอดด้านข้าง (ราคา/ลูก, ราคาลูกทั้งหมด, ยอดทั้งหมด, ลูกที่ใช้, เกมส์ทั้งหมด, ชั่วโมง, ค่าสนาม, ผู้เล่น, จำนวนเกมส์)
async function syncState(state, roster) {
  if (!isConfigured()) return { skipped: true, reason: 'Google Sheets ยังไม่ได้ตั้งค่า' };

  const sheets = await getSheetsClient();
  const tab = process.env.GOOGLE_SHEET_TAB || 'Sheet1';
  const totals = computeTotals(state.config, state.players);

  // สรุปยอดฝั่งขวา (คอลัมน์ L-M) เรียงเป็นคู่ label/value ทีละแถว
  const summaryPairs = [
    ['ราคา / ลูก', state.config.shuttleUnitPrice],
    ['ราคาลูกทั้งหมด', totals.totalShuttleFee],
    ['ยอดทั้งหมด', totals.grandTotal],
    ['ลูกแบดที่ใช้', state.config.shuttlesUsed],
    ['เกมส์ทั้งหมด (แมตช์)', totals.totalMatches],
    ['จำนวนชั่วโมง', state.config.hours],
    ['ค่าสนาม', totals.totalCourtFee],
    ['จำนวนผู้เล่น', totals.playerCount],
    ['จำนวนเกมส์', totals.totalGames],
  ];

  const rows = [];
  rows.push(['รายชื่อ', 'รายจ่าย/คน', 'ออนไลน์', 'จำนวนเกมส์', '', '', 'ค่าสนาม', 'ค่าลูก', '', '', '', 'สรุปยอด', '']);

  roster.players.forEach((name, idx) => {
    const p = state.players[name] || { online: false, games: 0 };
    const calc = totals.perPlayer[name] || { games: 0, courtFee: 0, shuttleFee: 0, total: 0 };
    const summaryRow = summaryPairs[idx] || ['', ''];
    rows.push([
      name,
      calc.total,
      p.online ? 1 : 0,
      calc.games,
      '', '',
      calc.courtFee,
      calc.shuttleFee,
      '', '', '',
      summaryRow[0],
      summaryRow[1],
    ]);
  });

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
