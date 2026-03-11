# Frontend - License Plate Recognition Web 💻

หน้า Web Application สำหรับให้ Admin/ผู้ดูแลลานจอดรถใช้งาน พัฒนาด้วย **React + Vite**

## 🌟 ฟีเจอร์หลัก (Features)
- **Live Monitoring** : หน้าแสดงผลรถเข้า-ออก (IN/OUT) แบบ Realtime ซึ่งอัปเดตอัตโนมัติ 100% (รับข้อมูลผ่าน WebSocket จาก Backend)
- **Dashboard Statistics** : กราฟ/สถิติประจำวัน รถผ่านเข้าออกกี่คัน แบ่งเป็นบุคคลภายใน vs บุคคลภายนอก
- **Member Management** : ระบบจัดการฐานข้อมูลสมาชิกขององค์กร (เพิ่ม, ลบ, แก้ไขชื่อและทะเบียนรถ)
- **Parking History** : ค้นหาประวัติการจอดรถย้อนหลัง 
- **Session Adjustment** : หากระบบ AI จับป้ายผิดพลาด แอดมินสามารถคลิกไปแก้ไขทะเบียนนั้น ๆ แบบแมนนวลได้ 

---

## 📁 โครงสร้างโปรเจกต์ (Folder Structure)

```
FrontEnd/LicensePlate-Web/
├── index.html       
├── package.json     
├── vite.config.js
└── src/
    ├── App.jsx        # Routing ของแอปพลิเคชัน
    ├── main.jsx       # Entry Point หลัก
    ├── services/
    │   └── api.js     # จุดศูนย์รวมการยิง API Call หา Backend (Axios)
    ├── components/    # (Re-usable React Components ควรอัพเดตในนี้)
    └── pages/         # (หน้า Page หลักตาม Navbar)
```

---

## ⚙️ Environment Configuration

สำหรับ Frontend สามารถตั้งค่า Endpoint ของ Backend ได้ที่ไฟล์ `src/services/api.js` (หากฝั่ง Backend ไม่ได้อยู่ที่ Localhost:8000)

```javascript
// ตัวอย่างที่อยู่ใน api.js
const API_BASE_URL = "http://localhost:8000/api";
const EVENTS_WS_URL = "ws://localhost:8000/ws/events";
```

---

## 🛠️ การติดตั้งและรันระบบ

1. เข้าไปที่โฟลเดอร์โปรเจกต์:
   ```bash
   cd FrontEnd/LicensePlate-Web
   ```
2. ติดตั้ง Node Packages (แนะนำ Node 18+):
   ```bash
   npm install
   ```
3. เริ่มต้น Development Server:
   ```bash
   npm run dev
   ```
   ระบบจะแสดง URL บน Terminal (โดยปกติจะเป็น `http://localhost:5173`)
4. Build สำหรับ Production:
   ```bash
   npm run build
   ```
   ไฟล์ที่สามารถนำไป Host (เช่น บน Vercel, Netlify) จะอยู่ในโฟลเดอร์ `/dist`
