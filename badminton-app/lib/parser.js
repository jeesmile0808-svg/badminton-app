// เรียก Claude API เพื่ออ่านข้อความ/ภาพจาก LINE แล้วจับคู่ชื่อคนกับสนามที่จะลง
const fetch = require('node-fetch');

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250929';

function buildPrompt(roster) {
  const names = roster.players.join(', ');
  const sessions = roster.sessions
    .map((s) => `สนาม ${s.id} (${s.label} เวลา ${s.time})`)
    .join(' / ');

  return `คุณเป็นผู้ช่วยจัดตารางแบดมินตันของกลุ่มไลน์ รายชื่อสมาชิกในกลุ่มทั้งหมดคือ:
${names}

สนามที่เปิดลงวันนี้คือ: ${sessions}

จากข้อความ/ภาพแชทที่แนบมา ให้วิเคราะห์ว่าใครแจ้งว่าจะไปเล่นสนามไหนบ้าง (คนหนึ่งอาจลงได้มากกว่า 1 สนาม)
- จับคู่ชื่อที่พบในข้อความกับชื่อในรายชื่อสมาชิกด้านบนให้ใกล้เคียงที่สุด (คนไทยมักพิมพ์ชื่อเล่นสั้นๆ หรือสะกดไม่ตรงเป๊ะ)
- ถ้าข้อความไม่ได้ระบุสนามชัดเจน แต่บริบทบ่งบอกว่าลงสนามไหน ให้อนุมานอย่างสมเหตุสมผล
- ถ้าเจอชื่อที่ไม่อยู่ในรายชื่อสมาชิก ให้ใส่ไว้ใน unmatched แทน อย่าเดามั่ว

ตอบกลับเป็น JSON เท่านั้น ไม่ต้องมีข้อความอื่น ตามรูปแบบนี้:
{
  "matches": [ { "name": "ชื่อที่ตรงกับรายชื่อสมาชิก", "sessions": [1,2] } ],
  "unmatched": ["ข้อความ/ชื่อที่จับคู่ไม่ได้"]
}`;
}

async function parseAttendance({ text, imageBase64, imageMediaType, roster }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ในไฟล์ .env');
  }

  const content = [{ type: 'text', text: buildPrompt(roster) }];

  if (text && text.trim()) {
    content.push({ type: 'text', text: `ข้อความจากไลน์:\n${text}` });
  }

  if (imageBase64) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: imageMediaType || 'image/png',
        data: imageBase64,
      },
    });
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const rawText = data.content && data.content[0] && data.content[0].text;
  if (!rawText) throw new Error('ไม่ได้รับข้อความตอบกลับจาก Claude');

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('แยกผลลัพธ์ JSON จาก Claude ไม่ได้: ' + rawText);

  return JSON.parse(jsonMatch[0]);
}

module.exports = { parseAttendance };
