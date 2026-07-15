let roster = null;
let state = null;
let lastParseResult = null;
const MAX_ON_COURT = 4;

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// สูตรเดียวกับ lib/calc.js ฝั่งเซิร์ฟเวอร์ (ต้องแก้พร้อมกันทั้งสองที่ถ้าจะเปลี่ยนสูตร)
function computeTotals(config, players) {
  const totalCourtFee = Math.round((config.courtHourlyRate || 0) * (config.hours || 0));
  const totalShuttleFee = Math.round((config.shuttleUnitPrice || 0) * (config.shuttlesUsed || 0));
  const grandTotal = totalCourtFee + totalShuttleFee;

  const names = Object.keys(players);
  const totalGames = names.reduce((sum, n) => sum + (players[n].online ? (players[n].games || 0) : 0), 0);
  const playerCount = names.filter(n => players[n].online).length;
  const totalMatches = totalGames > 0 ? +(totalGames / 4).toFixed(2) : 0;

  const perPlayer = {};
  names.forEach(name => {
    const p = players[name];
    const games = p.online ? (p.games || 0) : 0;
    const courtFee = totalGames > 0 ? Math.round((totalCourtFee / totalGames) * games) : 0;
    const shuttleFee = totalGames > 0 ? Math.round((totalShuttleFee / totalGames) * games) : 0;
    perPlayer[name] = { games, courtFee, shuttleFee, total: courtFee + shuttleFee };
  });

  return { totalCourtFee, totalShuttleFee, grandTotal, totalGames, totalMatches, playerCount, perPlayer };
}

async function loadAll() {
  const res = await fetch('/api/state');
  const data = await res.json();
  roster = data.roster;
  state = data.state;
  document.getElementById('dateInput').value = state.date;
  document.getElementById('cfgShuttlePrice').value = state.config.shuttleUnitPrice;
  document.getElementById('cfgShuttleCount').value = state.config.shuttlesUsed;
  document.getElementById('cfgCourtRate').value = state.config.courtHourlyRate;
  document.getElementById('cfgHours').value = state.config.hours;
  render();

  const sres = await fetch('/api/sheet-status');
  const sdata = await sres.json();
  const pill = document.getElementById('sheetStatus');
  if (sdata.configured) {
    pill.textContent = 'Google Sheets: เชื่อมต่อแล้ว';
    pill.className = 'status-pill status-ok';
  } else {
    pill.textContent = 'Google Sheets: ยังไม่ได้ตั้งค่า';
    pill.className = 'status-pill status-off';
  }
}


function countOnCourt() {
  return Object.values(state.players).filter(p => p.onCourt).length;
}

function renderCourtCell(name, p) {
  if (p.onCourt) {
    return `
      <div class="court-now-wrap">
        <span class="now-badge">NOW</span>
        <button class="court-btn finish" data-finish="${escapeHtml(name)}">จบเกมส์</button>
        <button class="court-btn cancel" data-cancel="${escapeHtml(name)}">ยกเลิก</button>
      </div>`;
  }
  return `<button class="court-btn idle" data-start="${escapeHtml(name)}">ไม่ได้ลงเล่น</button>`;
}

function startCourt(name) {
  if (countOnCourt() >= MAX_ON_COURT) {
    toast(`ลงคอร์ทเต็มแล้ว (สูงสุด ${MAX_ON_COURT} คน) กด "จบเกมส์" คนอื่นก่อน`);
    return;
  }
  state.players[name].onCourt = true;
  render();
}

function finishCourt(name) {
  const p = state.players[name];
  p.onCourt = false;
  p.online = true;
  p.games = (p.games || 0) + 1;
  render();
  toast(`${name} จบเกมส์ ✅ นับเพิ่ม 1 เกมส์ และคำนวณค่าใช้จ่ายใหม่แล้ว`);
}

function cancelCourt(name) {
  state.players[name].onCourt = false;
  render();
}

function render() {
  const totals = computeTotals(state.config, state.players);

  const bodyRows = document.getElementById('bodyRows');
  bodyRows.innerHTML = '';
  roster.players.forEach((name, idx) => {
    if (!state.players[name]) state.players[name] = { online: false, games: 0 };
    const p = state.players[name];
    const calc = totals.perPlayer[name];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td class="name-cell"><input class="name-input" data-idx="${idx}" value="${escapeHtml(name)}"></td>
      <td><button class="online-toggle ${p.online ? 'on' : 'off'}" data-name="${escapeHtml(name)}">${p.online ? 'มา' : 'ไม่มา'}</button></td>
      <td class="court-cell">${renderCourtCell(name, p)}</td>
      <td><input type="number" min="0" class="games-input" data-name="${escapeHtml(name)}" value="${p.games || 0}" ${p.online ? '' : 'disabled'}></td>
      <td class="readonly-cell">${calc.courtFee}</td>
      <td class="readonly-cell">${calc.shuttleFee}</td>
      <td class="readonly-cell">${calc.total}</td>
      <td><button class="danger" style="width:auto;padding:4px 10px;" data-remove="${idx}">ลบ</button></td>
    `;
    bodyRows.appendChild(tr);
  });

  bodyRows.querySelectorAll('.online-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      state.players[name].online = !state.players[name].online;
      if (!state.players[name].online) state.players[name].games = 0;
      render();
    });
  });
  bodyRows.querySelectorAll('.games-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const name = inp.dataset.name;
      state.players[name].games = Math.max(0, parseInt(inp.value, 10) || 0);
      render();
    });
  });
  bodyRows.querySelectorAll('.name-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const idx = Number(inp.dataset.idx);
      const oldName = roster.players[idx];
      const newName = inp.value.trim() || oldName;
      roster.players[idx] = newName;
      state.players[newName] = state.players[oldName] || { online: false, games: 0 };
      if (newName !== oldName) delete state.players[oldName];
      render();
    });
  });
  bodyRows.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.remove);
      const name = roster.players[idx];
      roster.players.splice(idx, 1);
      delete state.players[name];
      render();
    });
  });

  bodyRows.querySelectorAll('[data-start]').forEach(btn => {
    btn.addEventListener('click', () => startCourt(btn.dataset.start));
  });
  bodyRows.querySelectorAll('[data-finish]').forEach(btn => {
    btn.addEventListener('click', () => finishCourt(btn.dataset.finish));
  });
  bodyRows.querySelectorAll('[data-cancel]').forEach(btn => {
    btn.addEventListener('click', () => cancelCourt(btn.dataset.cancel));
  });

  const countPill = document.getElementById('courtCountPill');
  if (countPill) countPill.textContent = `กำลังลงคอร์ทตอนนี้: ${countOnCourt()} / ${MAX_ON_COURT}`;

  renderSummary(totals);
}

function renderSummary(totals) {
  const grid = document.getElementById('summaryGrid');
  grid.innerHTML = `
    <div class="summary-item"><div class="label">ราคาลูกทั้งหมด</div><div class="value">${totals.totalShuttleFee.toLocaleString()}</div></div>
    <div class="summary-item"><div class="label">ค่าสนามรวม</div><div class="value">${totals.totalCourtFee.toLocaleString()}</div></div>
    <div class="summary-item"><div class="label">จำนวนผู้เล่น</div><div class="value">${totals.playerCount}</div></div>
    <div class="summary-item"><div class="label">จำนวนเกมส์ (รวม)</div><div class="value">${totals.totalGames}</div></div>
    <div class="summary-item"><div class="label">เกมส์ทั้งหมด (แมตช์)</div><div class="value">${totals.totalMatches}</div></div>
  `;
  const gt = document.getElementById('grandTotalBox');
  gt.innerHTML = `ยอดสรุปรวมที่ต้องเก็บ<span class="amount">${totals.grandTotal.toLocaleString()} บาท</span>`;
}

document.getElementById('addPlayerBtn').addEventListener('click', () => {
  const name = prompt('ชื่อสมาชิกใหม่:');
  if (!name) return;
  roster.players.push(name.trim());
  state.players[name.trim()] = { online: false, games: 0 };
  render();
});

document.getElementById('dateInput').addEventListener('change', (e) => {
  state.date = e.target.value;
});

['cfgShuttlePrice', 'cfgShuttleCount', 'cfgCourtRate', 'cfgHours'].forEach(id => {
  document.getElementById(id).addEventListener('input', (e) => {
    const map = {
      cfgShuttlePrice: 'shuttleUnitPrice',
      cfgShuttleCount: 'shuttlesUsed',
      cfgCourtRate: 'courtHourlyRate',
      cfgHours: 'hours',
    };
    state.config[map[id]] = parseFloat(e.target.value) || 0;
    render();
  });
});

document.getElementById('saveBtn').addEventListener('click', async () => {
  roster.config = state.config;
  await fetch('/api/roster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(roster) });
  const res = await fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state }) });
  const data = await res.json();
  state = data.state;
  toast('บันทึกแล้ว ✅');
});

document.getElementById('resetBtn').addEventListener('click', async () => {
  if (!confirm('รีเซ็ตตารางทั้งหมด (ล้างออนไลน์/เกมส์ทุกคน)?')) return;
  const res = await fetch('/api/state/reset', { method: 'POST' });
  const data = await res.json();
  state = data.state;
  render();
  toast('รีเซ็ตตารางแล้ว');
});

document.getElementById('syncBtn').addEventListener('click', async () => {
  toast('กำลัง sync...');
  const res = await fetch('/api/sync-sheet', { method: 'POST' });
  const data = await res.json();
  if (data.error) return toast('เกิดข้อผิดพลาด: ' + data.error);
  if (data.skipped) return toast('ยังไม่ได้ตั้งค่า Google Sheets (ดู README)');
  toast('Sync ไป Google Sheet สำเร็จ ✅');
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
});

document.getElementById('parseBtn').addEventListener('click', async () => {
  const text = document.getElementById('lineText').value;
  const imageFile = document.getElementById('lineImage').files[0];
  if (!text.trim() && !imageFile) {
    toast('กรุณาวางข้อความ หรือแนบภาพก่อน');
    return;
  }
  const loading = document.getElementById('parseLoading');
  loading.style.display = 'inline';
  const fd = new FormData();
  fd.append('text', text);
  if (imageFile) fd.append('image', imageFile);

  try {
    const res = await fetch('/api/parse', { method: 'POST', body: fd });
    const data = await res.json();
    loading.style.display = 'none';
    if (data.error) { toast('เกิดข้อผิดพลาด: ' + data.error); return; }
    lastParseResult = data;
    showPreview(data);
  } catch (err) {
    loading.style.display = 'none';
    toast('เกิดข้อผิดพลาด: ' + err.message);
  }
});

function showPreview(data) {
  const box = document.getElementById('previewBox');
  const matches = data.matches || [];
  const unmatched = data.unmatched || [];
  let html = '<b>AI พบว่า:</b><br>';
  if (matches.length === 0) html += '<i>ไม่พบรายชื่อที่จับคู่ได้</i><br>';
  matches.forEach(m => {
    html += `${escapeHtml(m.name)} → มา, เล่น ${m.games} เกมส์<br>`;
  });
  if (unmatched.length) {
    html += '<br><b>จับคู่ไม่ได้ (ตรวจสอบเอง):</b><br>' + unmatched.map(u => escapeHtml(u)).join('<br>');
  }
  box.innerHTML = html;
  box.style.display = 'block';
  document.getElementById('applyRow').style.display = 'flex';
}

document.getElementById('applyBtn').addEventListener('click', () => {
  if (!lastParseResult) return;
  (lastParseResult.matches || []).forEach(m => {
    if (!state.players[m.name]) {
      roster.players.push(m.name);
      state.players[m.name] = { online: false, games: 0 };
    }
    state.players[m.name].online = true;
    state.players[m.name].games = m.games || 1;
  });
  render();
  document.getElementById('applyRow').style.display = 'none';
  document.getElementById('previewBox').style.display = 'none';
  document.getElementById('lineText').value = '';
  document.getElementById('lineImage').value = '';
  toast('ติ๊กให้อัตโนมัติแล้ว อย่าลืมกด "บันทึกตาราง" ✅');
});

document.getElementById('discardBtn').addEventListener('click', () => {
  lastParseResult = null;
  document.getElementById('applyRow').style.display = 'none';
  document.getElementById('previewBox').style.display = 'none';
});

loadAll();
