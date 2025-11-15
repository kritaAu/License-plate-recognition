// src/services/dashboardApi.js
export async function fetchTodayEvents(limit = 10000, dateStr) {
  const API = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const pad2 = (n) => String(n).padStart(2, "0");

  // ถ้าไม่ส่งวันที่มา ใช้ “วันนี้ (local)”
  let day = dateStr;
  if (!day) {
    const now = new Date();
    day = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  }

  const url = `${API}/events?start_date=${day}&end_date=${day}&limit=${limit}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const rows = await res.json();

  //  แปลงเป็นรูปแบบที่หน้า Home/กราฟ/ตารางคาดหวัง
  return (Array.isArray(rows) ? rows : []).map((e) => ({
    ...e,
    // ปกติ /events ส่ง time ไม่ใช่ datetime
    datetime: e.datetime || e.time || null,
    // ปกติ /events ส่ง status ภาษาไทย → แปลงเป็น direction
    direction:
      e.direction ||
      (e.status === "เข้า" ? "in" : e.status === "ออก" ? "out" : ""),
    // role ไม่มีใน /events → สร้างจาก check (บุคคลภายใน/ภายนอก)
    role: e.role || (String(e.check || "").includes("ภายใน") ? "internal" : "visitor"),
    // รูป: รวมทุกชื่อฟิลด์ที่เป็นไปได้
    image: e.image || e.imgUrl || e.blob || null,
    blob: e.blob || e.image || e.imgUrl || null,
  }));
}
