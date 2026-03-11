# License Plate Recognition System 🚗🔍

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com)
[![Ultralytics YOLO](https://img.shields.io/badge/YOLO-Ultralytics-blue)](https://github.com/ultralytics/ultralytics)

ระบบบริหารจัดการลานจอดรถครบวงจรที่ทำงานร่วมกับ AI (YOLO + GPT-4o OCR) เพื่อตรวจจับและอ่านป้ายทะเบียนรถมอเตอร์ไซค์/รถยนต์โดยอัตโนมัติ

---

## 🏗️ System Architecture

โปรเจกต์นี้แบ่งออกเป็น 2 ส่วนหลัก (คลิกที่ชื่อเพื่อดูรายละเอียดเพิ่มเติม):

1. **[BackEnd](./BackEnd/README.md)** (Python / FastAPI / YOLO / Supabase)
   - จัดการ AI Model สำหรับ Object Detection (YOLO)
   - ตัดภาพ (Crop) และส่งให้ GPT-4o ทำ OCR อ่านป้ายทะเบียน
   - API แบบ Modular (Auth, Members, Events, Parking, Dashboard)
   - การจับคู่รถเข้า-ออก (Parking Session Matching Logic)
   - ระบบแจ้งเตือน Real-time ด้วย WebSocket

2. **[FrontEnd](./FrontEnd/README.md)** (React / Vite)
   - หน้า Dashboard สำหรับ Admin เพื่อดูสถิติ
   - หน้า Live Stream สดจากกล้อง ทางเข้า/ทางออก
   - ระบบจัดการ Members และทะเบียนรถที่ลงทะเบียนไว้
   - ประวัติการเข้าออก (Events & Parking Sessions)

---

## 🚀 Quick Start (ภาพรวม)

### สิ่งที่ต้องมีเบื้องต้น
- **Python 3.10+**
- **Node.js 18+**
- บัญชีและโปรเจกต์บน **Supabase** (PostgreSQL Database + Storage)
- บัญชี **OpenAI** (สำหรับ API Key ในการทำ OCR)

### 1. การจำลอง/รัน Backend
```bash
cd BackEnd

# ติดตั้ง Dependencies
pip install -r requirements.txt
pip install "websockets<16,>=14" # จำเป็นสำหรับเชื่อมต่อ Supabase Realtime

# ตั้งค่า Environment Variables (คัดลอกไฟล์ .env.example และใส่ Key)
# รัน Server
uvicorn main_api:app --reload --host 0.0.0.0 --port 8000
```
API Documentation (Swagger UI) จะอยู่ที่ `http://localhost:8000/docs`

### 2. การจำลอง/รัน Frontend
```bash
cd FrontEnd/LicensePlate-Web

# ติดตั้ง Dependencies
npm install

# รัน Server สำหรับพัฒนา
npm run dev
```
เข้าถึงหน้าเว็บได้ที่ `http://localhost:5173`

---

## 🛡️ Security
โปรเจกต์นี้มีการกำหนด `.gitignore` ที่ครอบคลุม **ห้ามทำการ Commit ไฟล์ `.env` ขึ้น Git Repository เด็ดขาด** เนื่องจากมีข้อมูลงความลับเช่น Supabase Key และ OpenAI API Key.