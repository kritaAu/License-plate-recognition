# Backend - License Plate Recognition ⚙️

ระบบให้บริการ API สำหรับจัดการข้อมูล, การทำงานของ AI สำหรับจับป้ายทะเบียนตั้งแต่อ่านภาพจนถึงบันทึกลง Database, และดูแล Business Logic ทั้งหมด

## 🌟 ฟีเจอร์หลัก (Features)
- **AI Processing Unit** : 
  - `batch_process.py`: สคริปต์รับรูปภาพจากกล้อง รันโมเดล YOLO เพื่อหาตัวรถมอเตอร์ไซค์และป้ายทะเบียน
  - `OCR_ai.py`: ส่งภาพที่ Crop ป้ายทะเบียนแล้วไปให้ OpenAI (GPT-4o) อ่านข้อความ
- **Modular API Architecture** : แบ่งกลุ่มของ API ชัดเจน (`/api/auth`, `/api/members`, `/api/events`, `api/parking/session`, `/dashboard`)
- **Smart Matching Logic** : อัลกอริทึมในการจับคู่รถที่ออก (`OUT`) ให้ตรงกับรถที่เข้ามา (`IN`) แม้ป้ายทะเบียนที่ AI อ่านมาอาจจะผิดพลาดเล็กน้อย (Fuzzy Logic) (`matching_logic.py`, `background_matcher.py`)
- **Realtime WebSocket** : Broadcast ข้อมูลเวลารถเข้า-ออก ให้ Frontend รับรู้ทันทีทันใด
- **Database Schema (Supabase)**: `Users`, `Member`, `Vehicle`, `Event`, `ParkingSession`

---

## 📁 โครงสร้างโปรเจกต์ (Folder Structure)

```
BackEnd/
├── .env                 # (ไม่มีใน Git) ควบคุม Environment Vars
├── main_api.py          # Entry point ของ FastAPI app
├── helpers.py           # ฟังก์ชันอรรถประโยชน์ส่วนกลาง (Helper)
├── utils.py             # ฟังก์ชันจัดการรูปและเชื่อม Storage
├── OCR_ai.py            # การเรียกใช้ OpenAI OCR
├── batch_process.py     # AI Batch Processing
├── matching_logic.py    # โลจิกจับคู่รถ (Exact, Fuzzy)
├── background_matcher.py# Background Task ดักจับรถที่ติดค้าง
├── core/                # โฟลเดอร์ควบคุมระบบแกนกลาง
│   ├── config.py
│   ├── database.py      # Supabase Client
│   ├── security.py      # JWT & Auth
│   └── websocket.py     # WebSocket Manager
├── models/
│   └── schemas.py       # Pydantic รูปแบบ Data Request/Response
└── routers/             # แบ่ง Route ไฟล์ต่าง ๆ
    ├── auth.py
    ├── dashboard.py
    ├── events.py
    ├── members.py
    ├── parking.py
    └── upload_export.py
```

---

## ⚙️ Environment Variables (`.env`)

คุณต้องสร้างไฟล์ `.env` ที่ root ของ `BackEnd/` โดยมี Key เหล่านี้:
```env
# ตั้งค่า Supabase สำหรับ Database
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key

# ตั้งค่าการเข้ารหัส JWT (ตั้งเป็น String ยาวๆ หรือ Hash ยากๆ)
SECRET_KEY=generate_your_own_secret_key_here

# ตั้งค่า AI OCR (OpenAI)
OPENAI_API_KEY=sk-your_openai_api_key

# ตั้งค่า Admin User เบื้องต้น (จะใช้งานร่วมกับ DB)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_password
```

---

## 🛠️ การติดตั้งและรันระบบ

1. ติดตั้ง Python Packages:
   ```bash
   pip install -r requirements.txt
   pip install "websockets<16,>=14"
   ```
2. โหลดโมเดลสำหรับ YOLO:
   > 📌 *ระบบต้องการโมเดล `.pt` สำหรับ Ultralytics YOLO วางไว้ใน directory /models (อิงตามที่โค้ดกำหนด)*
3. เริ่มต้น Server:
   ```bash
   uvicorn main_api:app --reload
   ```

ระบบจะทำงานที่ `http://127.0.0.1:8000/docs` สำหรับดู API ทั้งหมด