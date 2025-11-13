// utils/date.js

/** ปรับรูปสตริงวันเวลาให้ Date อ่านได้ เช่น "2025-11-14 12:34:56" -> "2025-11-14T12:34:56" */
export function parseDT(input) {
  if (!input && input !== 0) return new Date(NaN);

  // รองรับ Date / number / string
  if (input instanceof Date) return new Date(input.getTime());
  if (typeof input === "number") return new Date(input);

  let s = String(input).trim();
  // ถ้าเป็นรูปแบบ "YYYY-MM-DD HH:mm:ss" ให้เติม 'T'
  if (s.length > 10 && s[10] === " ") s = s.replace(" ", "T");

  // หมายเหตุ: new Date('YYYY-MM-DD') ในบางบราวเซอร์ตีความเป็น UTC
  // ถ้ามีแค่วันที่อย่างเดียว ให้บังคับเวลา 00:00:00 local
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
    return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0); // สร้างแบบ Local
  }

  return new Date(s);
}

/** คีย์วันที่แบบ Local: "YYYY-MM-DD" (ใช้เช็คว่าอยู่วันเดียวกันแบบ Local) */
export function toLocalDateKey(dateish) {
  const d = dateish instanceof Date ? dateish : parseDT(dateish);
  if (Number.isNaN(+d)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** คืนค่า "dd/mm/yyyy HH:MM:SS" ตามเวลาเครื่อง (Local time) */
export function formatThaiDateTime(dateish) {
  if (!dateish && dateish !== 0) return "-";
  try {
    const d = dateish instanceof Date ? dateish : parseDT(dateish);
    if (Number.isNaN(+d)) return "-";

    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");

    return `${dd}/${mm}/${yy} ${hh}:${mi}:${ss}`;
  } catch (err) {
    console.error("Invalid date:", dateish, err);
    return "Invalid Date";
  }
}

/** "dd/mm/yyyy" แบบ Local */
export function formatThaiDate(dateish) {
  const d = dateish instanceof Date ? dateish : parseDT(dateish);
  if (Number.isNaN(+d)) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

/** today เป็นคีย์ Local "YYYY-MM-DD" */
export function todayLocalKey() {
  return toLocalDateKey(new Date());
}

/** เพิ่มวันแบบ Local */
export function addDays(dateish, days) {
  const d = dateish instanceof Date ? new Date(dateish.getTime()) : parseDT(dateish);
  d.setDate(d.getDate() + (days || 0));
  return d;
}

/** เริ่มสัปดาห์ (จันทร์) แบบ Local */
export function startOfWeekLocal(dateish) {
  const d = dateish instanceof Date ? new Date(dateish.getTime()) : parseDT(dateish);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // จันทร์=0 ... อาทิตย์=6
  d.setDate(d.getDate() - day);
  return d;
}
