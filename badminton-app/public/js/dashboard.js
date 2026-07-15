let roster = null;
let state = null;
let lastParseResult = null;

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

async function loadAll() {
  const res = await fetch('/api/state');
  const data = await res.json();
  roster = data.roster;
  state = data.state;
  document.getElementById('dateInput').value = state.date;
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

function render() {
  const headRow = document.getElementById('headRow');
  headRow.innerHTML = '<th>#</th><th style="text-align:left;">ชื่อ</th>' +
    roster.sessions.map(s => `<th class="session-header">${s.label}<small>${s.time}</small></th>`).join('') +
    '<th></th>';

  const bodyRows = document.getElementById('bodyRows');
  bodyRows.innerHTML = '';
  roster.players.forEach((name, idx) => {
    if (!state.attendance[name]) state.attendance[name] = {};
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td class="name-cell"><input class="name-input" data-idx="${idx}" value="${escapeHtml(name)}"></td>
      ${roster.sessions.map(s => `
        <td><input type="checkbox" data-name="${escapeHtml(name)}" data-session="${s.id}" ${state.attendance[name][s.id] ? 'checked' : ''}></td>
      `).join('')}
      <td><button class="danger" style="width:auto;padding:4px 10px;" data-remove="${idx}">ลบ</button></td>
    `;
    bodyRows.appendChild(tr);
  });

  // total row
  const totalRow = document.getElementById('totalRow');
  const totals = roster.sessions.map(s =>
    roster.players.filter(n => state.attendance[n] && state.attendance[n][s.id]).length
  );
  totalRow.innerHTML = `<td></td><td style="text-align:left;">รวม</td>` +
    totals.map(t => `<td>${t}</td>`).join('') + `<td></td>`;

  // bind events
  bodyRows.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      const name = cb.dataset.name;
      const sid = cb.dataset.session;
      state.attendance[name][sid] = cb.checked;
      render();
    });
  });
  bodyRows.querySelectorAll('.name-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const idx = Number(inp.dataset.idx);
      const oldName = roster.players[idx];
      const newName = inp.value.trim() || oldName;
      roster.players[idx] = newName;
      state.attendance[newName] = state.attendance[oldName] || {};
      if (newName !== oldName) delete state.attendance[oldName];
      render();
    });
  });
  bodyRows.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.remove);
      const name = roster.players[idx];
      roster.players.splice(idx, 1);
      delete state.attendance[name];
      render();
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

document.getElementById('addPlayerBtn').addEventListener('click', () => {
  const name = prompt('ชื่อสมาชิกใหม่:');
  if (!name) return;
  roster.players.push(name.trim());
  state.attendance[name.trim()] = {};
  render();
});

document.getElementById('dateInput').addEventListener('change', (e) => {
  state.date = e.target.value;
});

document.getElementById('saveBtn').addEventListener('click', async () => {
  await fetch('/api/roster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(roster) });
  const res = await fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state }) });
  const data = await res.json();
  state = data.state;
  toast('บันทึกแล้ว ✅');
});

document.getElementById('resetBtn').addEventListener('click', async () => {
  if (!confirm('ล้างการติ๊กทั้งหมด?')) return;
  const res = await fetch('/api/state/reset', { method: 'POST' });
  const data = await res.json();
  state = data.state;
  render();
  toast('ล้างตารางแล้ว');
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
    html += `${escapeHtml(m.name)} → สนาม ${m.sessions.join(', ')}<br>`;
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
    if (!state.attendance[m.name]) {
      // ชื่อใหม่ที่ไม่อยู่ใน roster เดิม ให้เพิ่มเข้าไป
      roster.players.push(m.name);
      state.attendance[m.name] = {};
    }
    m.sessions.forEach(sid => {
      state.attendance[m.name][sid] = true;
    });
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
