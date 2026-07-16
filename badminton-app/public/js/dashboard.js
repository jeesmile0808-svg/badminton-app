let roster = null;
let state = null;
let lastParseResult = null;
let beforeApplySnapshot = null;

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
    const courtFee = totalGames > 0 ? Math.ceil((totalCourtFee / totalGames) * games) : 0;
    const shuttleFee = totalGames > 0 ? Math.ceil((totalShuttleFee / totalGames) * games) : 0;
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
  await fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state }) });

  // บันทึกยอดล่าสุดเรียบร้อยแล้ว เคลียร์ตาราง (ออนไลน์/เกมส์) ให้พร้อมกรอกรอบใหม่ทันที
  // ราคาที่ตั้งไว้ (ราคาลูก/ค่าสนาม/ชม.) จะยังคงอยู่เหมือนเดิม
  const res = await fetch('/api/state/reset', { method: 'POST' });
  const data = await res.json();
  state = data.state;
  render();
  toast('บันทึกยอดล่าสุดแล้ว ✅ เคลียร์ตารางพร้อมกรอกรอบใหม่');
});

document.getElementById('resetBtn').addEventListener('click', async () => {
  if (!confirm('ล้างตารางทั้งหมด (ออนไลน์/เกมส์ทุกคน) โดยไม่บันทึกก่อน?')) return;
  const res = await fetch('/api/state/reset', { method: 'POST' });
  const data = await res.json();
  state = data.state;
  render();
  toast('ล้างตารางแล้ว');
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
});

async function runParse() {
  const textEl = document.getElementById('lineText');
  const text = textEl.value;
  if (!text.trim()) {
    toast('กรุณาพิมพ์หรือวางข้อความก่อน');
    return;
  }
  const loading = document.getElementById('parseLoading');
  loading.style.display = 'inline';

  try {
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    loading.style.display = 'none';
    if (data.error) { toast('เกิดข้อผิดพลาด: ' + data.error); return; }
    applyParseResult(data);
    textEl.value = '';
  } catch (err) {
    loading.style.display = 'none';
    toast('เกิดข้อผิดพลาด: ' + err.message);
  }
}

function applyParseResult(data) {
  // เก็บสถานะก่อนหน้าไว้ ให้กด "ย้อนกลับ" ได้ 1 ครั้งล่าสุด
  beforeApplySnapshot = JSON.parse(JSON.stringify(state.players));

  const matches = data.matches || [];
  const unmatched = data.unmatched || [];

  matches.forEach(m => {
    if (!state.players[m.name]) {
      roster.players.push(m.name);
      state.players[m.name] = { online: false, games: 0 };
    }
    state.players[m.name].online = true;
    state.players[m.name].games = (state.players[m.name].games || 0) + (m.games || 1);
  });
  render();

  const box = document.getElementById('previewBox');
  let html = '<b>คำนวณแล้ว:</b><br>';
  if (matches.length === 0) html += '<i>ไม่พบรายชื่อที่จับคู่ได้</i><br>';
  matches.forEach(m => {
    html += `${escapeHtml(m.name)} → มา, เพิ่ม ${m.games || 1} เกมส์<br>`;
  });
  if (unmatched.length) {
    html += '<br><b>จับคู่ไม่ได้ (ตรวจสอบเอง):</b><br>' + unmatched.map(u => escapeHtml(u)).join('<br>');
  }
  box.innerHTML = html;
  box.style.display = 'block';

  toast('คำนวณและบันทึกลงตารางแล้ว ✅ กดย้อนกลับได้ถ้าพิมพ์ผิด');
}

document.getElementById('parseBtn').addEventListener('click', runParse);

document.getElementById('lineText').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    runParse();
  }
});

document.getElementById('undoBtn').addEventListener('click', () => {
  if (!beforeApplySnapshot) {
    toast('ไม่มีอะไรให้ย้อนกลับ');
    return;
  }
  state.players = beforeApplySnapshot;
  beforeApplySnapshot = null;
  render();
  document.getElementById('previewBox').style.display = 'none';
  toast('ย้อนกลับแล้ว');
});

loadAll();
