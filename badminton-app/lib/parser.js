// เรียก Claude API เพื่ออ่านข้อความจาก LINE แล้วแยกว่าแต่ละ "รายการ/บรรทัด/เกมส์" มีใครบ้าง
// หมายเหตุสำคัญ: เจตนาไม่ให้ AI นับจำนวนเกมส์รวมเอง เพราะ LLM นับซ้ำๆ ในข้อความยาวๆ แล้วพลาดได้
// (เคยเจอเคสจริง: 15 บรรทัด AI นับผิดไป 3 ชื่อ) ให้ AI แค่แยกโครงสร้างว่าใครอยู่บรรทัดไหนบ้าง
// แล้วให้โค้ดเราเองนับจำนวนครั้งที่แต่ละชื่อปรากฏ ซึ่งแม่นยำ 100% เสมอ
const fetch = require('node-fetch');

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250929';

function buildPrompt(roster) {
  const names = roster.players.join(', ');

  return `คุณเป็นผู้ช่วยจัดตารางแบดมินตันของกลุ่มไลน์ รายชื่อสมาชิกในกลุ่มทั้งหมดคือ:
${names}

หน้าที่ของคุณคือ "แยกโครงสร้าง" ข้อความออกเป็นรายการ (lines) เท่านั้น ห้ามนับสรุปจำนวนเกมส์รวมของแต่ละคนเอง เดี๋ยวมีโปรแกรมนับให้ทีหลัง

กติกา:
- ถ้าข้อความเป็นรายชื่อหลายบรรทัด แต่ละบรรทัดคือ 1 เกมส์ที่มีคนเล่นด้วยกัน ให้แยกเป็น 1 รายการ (array) ต่อ 1 บรรทัด ใส่ชื่อสมาชิกทุกคนที่อยู่บรรทัดนั้น
- ถ้าข้อความบอกตรงๆ ว่าคนนี้เล่นไปกี่เกมส์ (เช่น "เยียนเล่น 4 เกมส์") ให้สร้างรายการ (array ที่มีแค่ชื่อนั้นชื่อเดียว) ซ้ำกันตามจำนวนเกมส์ที่บอก เช่น เล่น 4 เกมส์ ให้สร้าง ["เยียน"] จำนวน 4 รายการ
- ถ้าบอกแค่ว่ามา แต่ไม่ได้ระบุจำนวนเกมส์เลย ให้สร้างรายการเดียว ["ชื่อนั้น"] (นับเป็น 1 เกมส์)
- จับคู่ชื่อเล่น/คำที่สะกดไม่ตรงกับรายชื่อสมาชิกด้านบนให้ใกล้เคียงที่สุด แล้วใช้ชื่อเต็มตามรายชื่อสมาชิกเสมอในผลลัพธ์ (คนไทยมักพิมพ์ชื่อเล่นสั้นๆ หรือย่อ เช่น "ล.วิ" อาจหมายถึงคนที่ชื่อเต็มขึ้นต้นด้วยคำใกล้เคียง)
- ห้ามรวมชื่อซ้ำในรายการเดียวกัน (1 บรรทัด/1 รายการ ชื่อไม่ควรซ้ำกันเอง)
- ถ้าเจอชื่อที่ไม่อยู่ในรายชื่อสมาชิกจริงๆ (จับคู่ไม่ได้เลย) ให้ใส่ไว้ใน unmatched แทน อย่าเดามั่ว

ตอบกลับเป็น JSON เท่านั้น ไม่ต้องมีข้อความอื่น ไม่ต้องคำนวณผลรวมใดๆ ตามรูปแบบนี้:
{
  "lines": [ ["ชื่อ1", "ชื่อ2", "ชื่อ3", "ชื่อ4"], ["ชื่อ1"], ... ],
  "unmatched": ["ข้อความ/ชื่อที่จับคู่ไม่ได้"]
}`;
}

// นับจำนวนครั้งที่แต่ละชื่อปรากฏใน lines ทั้งหมด ด้วยโค้ดล้วนๆ (ไม่ใช้ AI) เพื่อความแม่นยำ 100%
function tallyLines(lines) {
  const counts = {};
  (lines || []).forEach((line) => {
    (line || []).forEach((name) => {
      if (!name) return;
      counts[name] = (counts[name] || 0) + 1;
    });
  });
  return Object.keys(counts).map((name) => ({ name, games: counts[name] }));
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
      max_tokens: 2048,
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

  const parsed = JSON.parse(jsonMatch[0]);
  const matches = tallyLines(parsed.lines);
  return { matches, unmatched: parsed.unmatched || [] };
}

module.exports = { parseAttendance };
