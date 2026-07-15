# ตารางแบดมินตัน — แอปแอดมิน

เว็บแอปสำหรับแอดมินกลุ่มไลน์แบดมินตัน:
- ล็อกอินด้วยรหัสผ่านเดียวของกลุ่ม
- วางข้อความ/แนบภาพจากไลน์ แล้วให้ AI (Claude) อ่านและติ๊กชื่อ+สนามลงตารางให้อัตโนมัติ
- แก้ตารางเองได้ (เพิ่ม/ลบ/แก้ชื่อ, ติ๊กเอง)
- Sync ตารางไปยัง Google Sheet ของคุณ (ลิงก์ชีตที่ให้มา) ได้ 1 คลิก

## รันทดสอบในเครื่องตัวเอง

```bash
npm install
cp .env.example .env
# แก้ .env ใส่ GROUP_PASSWORD, ANTHROPIC_API_KEY อย่างน้อย
npm start
```

เปิด http://localhost:3000

## ตั้งค่าที่ต้องทำก่อนใช้งานจริง

### 1. รหัสผ่านกลุ่ม
ตั้งค่า `GROUP_PASSWORD` ใน `.env` เป็นรหัสที่แจกให้แอดมินในกลุ่ม (เปลี่ยนได้ตลอดเวลา)

### 2. Anthropic API key (สำหรับ AI อ่านข้อความ/ภาพ)
1. ไปที่ https://console.anthropic.com/settings/keys
2. สร้าง API key
3. ใส่ในตัวแปร `ANTHROPIC_API_KEY`

หมายเหตุ: การเรียก Claude API มีค่าใช้จ่ายตามการใช้งานจริง (ปกติไม่กี่บาทต่อครั้ง สำหรับข้อความ/ภาพสั้นๆ)

### 3. เชื่อมกับ Google Sheet ของคุณ (ไม่บังคับ แต่แนะนำ)
ชีตของคุณ: https://docs.google.com/spreadsheets/d/1NX56pY2NYGum3XhE8OaDmunF49yl2PP1aRfBmXgwlxk

1. ไปที่ https://console.cloud.google.com/ สร้างโปรเจกต์ใหม่ (หรือใช้โปรเจกต์เดิม)
2. เปิดใช้งาน "Google Sheets API"
3. ไปที่ "IAM & Admin" > "Service Accounts" > สร้าง Service Account ใหม่
4. สร้าง Key แบบ JSON แล้วดาวน์โหลดไฟล์ credential ลงมา
5. เปิดไฟล์ JSON นั้น คัดลอกทั้งก้อน (บีบให้เป็นบรรทัดเดียว) ใส่ในตัวแปร `GOOGLE_SERVICE_ACCOUNT_JSON`
6. เปิด Google Sheet ของคุณ กด "Share" แล้วเพิ่มอีเมลของ service account (รูปแบบ `xxx@xxx.iam.gserviceaccount.com`) เป็น **Editor**
7. `GOOGLE_SHEET_ID` ตั้งเป็น `1NX56pY2NYGum3XhE8OaDmunF49yl2PP1aRfBmXgwlxk` (ใส่ให้แล้วใน .env.example)
8. `GOOGLE_SHEET_TAB` ใส่ชื่อแท็บ (tab) ที่ต้องการให้เขียนข้อมูลลง

ถ้าไม่ตั้งค่าส่วนนี้ แอปจะยังใช้งานได้ปกติ แค่ข้อมูลจะเก็บในไฟล์ local (`data/state.json`) แทน ไม่ sync ไปชีต

## Deploy จริงให้ทุกคนในกลุ่มเข้าใช้ได้ (แนะนำ Render.com — มี free tier)

1. สร้างบัญชีที่ https://render.com (ฟรี)
2. อัปโหลดโค้ดโฟลเดอร์นี้ขึ้น GitHub repo (หรือใช้ "public git repo" อื่น)
3. ใน Render กด "New +" > "Web Service" > เชื่อม repo
4. ตั้งค่า:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. ไปที่ "Environment" ใส่ตัวแปรทั้งหมดจาก `.env.example` (ใส่ค่าจริง ไม่ใช่ตัวอย่าง)
6. Deploy — จะได้ลิงก์ เช่น `https://your-app.onrender.com` ให้แอดมินในกลุ่มใช้เข้าเว็บ

ทางเลือกอื่น: Railway.app, Fly.io ก็ใช้ขั้นตอนคล้ายกัน (deploy จาก Git repo + ตั้งค่า env vars)

⚠️ Free tier ของ Render จะ sleep เมื่อไม่มีคนใช้งาน และตื่นช้าประมาณ 30-50 วินาทีตอนเปิดครั้งแรก ถ้าต้องการให้เร็วตลอดเวลาต้องอัปเกรดเป็นแผนเสียเงิน (เริ่มต้นประมาณ $7/เดือน)

## โครงสร้างไฟล์

```
badminton-app/
  server.js          # เซิร์ฟเวอร์หลัก (Express)
  lib/
    auth.js           # ตรวจสอบล็อกอิน
    parser.js          # เรียก Claude API อ่านข้อความ/ภาพ
    sheets.js           # sync ไป Google Sheets
    store.js            # เก็บ/โหลดข้อมูลจากไฟล์ local
  public/
    login.html
    dashboard.html
    css/style.css
    js/dashboard.js
  data/
    roster.json          # รายชื่อสมาชิก + สนาม (แก้ในแอปได้เลย ไม่ต้องแก้ไฟล์)
    state.json            # ข้อมูลการติ๊กปัจจุบัน (สร้างอัตโนมัติ)
```

## หมายเหตุสำคัญ

- รายชื่อสมาชิกเริ่มต้นใน `data/roster.json` เป็นค่าตั้งต้นคร่าวๆ (อ่านจากภาพตัวอย่างที่ให้มาซึ่งตัวอักษรเล็กมากทำให้ OCR ไม่แม่นยำ 100%) **ให้เข้าไปแก้ชื่อให้ถูกต้องในหน้าแอปได้เลยที่ตาราง** (คลิกที่ช่องชื่อแล้วพิมพ์ใหม่) ก่อนเริ่มใช้งานจริง
- AI จะพยายามจับคู่ชื่อเล่น/คำที่สะกดไม่ตรงกับรายชื่อสมาชิกให้ใกล้เคียงที่สุด แต่แนะนำให้แอดมินตรวจสอบผลลัพธ์ใน "preview" ก่อนกด "ใช้ผลลัพธ์นี้" ทุกครั้ง
- ระบบล็อกอินเป็นรหัสผ่านเดียวสำหรับทั้งกลุ่ม (ตามที่เลือก) เหมาะกับกลุ่มเล็กที่ไว้ใจกันได้ ถ้าต้องการแยกบัญชีต่อคนในอนาคต สามารถขยายระบบ auth เพิ่มได้
