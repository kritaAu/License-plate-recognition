// src/services/searchApi.js
export const API =
  (import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

/* ---------------- helpers ---------------- */
async function handle(res) {
  if (res.ok) {
    try { return await res.json(); } catch { return {}; }
  }

  // แปลง error ของ FastAPI ให้อ่านง่าย
  let msg = `HTTP ${res.status}`;
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      if (Array.isArray(j.detail)) {
        msg = j.detail.map(e => e.msg || e.detail || JSON.stringify(e)).join(" | ");
      } else {
        msg = j.detail || j.message || text || msg;
      }
    } catch {
      msg = text || msg;
    }
  } catch {}
  throw new Error(msg);
}

const clean = (obj) =>
  Object.fromEntries(Object.entries(obj || {}).filter(([_, v]) => v !== "" && v != null));

const numify = (v) =>
  typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;

/* ---------------- API ---------------- */

// ดึงสมาชิกทั้งหมด
export async function getMembers() {
  return handle(await fetch(`${API}/members`));
}

// อัปเดตเฉพาะข้อมูลสมาชิก (ไม่รวมป้ายทะเบียน)
export async function updateMember(memberId, payload) {
  const body = clean({
    firstname: payload.firstname?.trim(),
    lastname:  payload.lastname?.trim(),
    // ถ้าเป็นค่าว่างจะไม่ส่งไปเลย, ถ้าเป็นตัวเลขล้วนจะแปลงเป็น Number
    std_id:
      payload.std_id === "" || payload.std_id == null
        ? undefined
        : numify(String(payload.std_id).trim()),
  });

  return handle(
    await fetch(`${API}/members/${memberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

// ลบสมาชิก
export async function deleteMember(memberId) {
  return handle(await fetch(`${API}/members/${memberId}`, { method: "DELETE" }));
}

// สมัครสมาชิกพร้อมรถ (payload ต้องเป็นแบบซ้อน { member:{...}, vehicle:{...} })
export async function registerMemberWithVehicle(data) {
  const member = clean({
    firstname: data.member?.firstname?.trim(),
    lastname:  data.member?.lastname?.trim(),
    role:      data.member?.role, // "นักศึกษา" | "อาจารย์" | "เจ้าหน้าที่" | "อื่น ๆ"
    std_id:
      data.member?.std_id === "" || data.member?.std_id == null
        ? undefined
        : numify(String(data.member.std_id).trim()),
    faculty:   data.member?.faculty?.trim(),
    major:     data.member?.major?.trim(),
  });

  const vehicle = clean({
    plate:    data.vehicle?.plate?.trim(),
    province: data.vehicle?.province?.trim(),
  });

  return handle(
    await fetch(`${API}/members/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member, vehicle }),
    })
  );
}

/* ---------- (เลือกใช้) ตรวจป้ายทะเบียน ---------- */
export async function checkPlate({ plate, province } = {}) {
  const params = new URLSearchParams();
  if (plate) params.set("plate", plate.trim());
  if (province) params.set("province", province.trim());
  return handle(await fetch(`${API}/check_plate?${params.toString()}`));
}

const _plateCache = new Map();
export async function checkPlateCached(plate, province) {
  const key = `${(plate || "").trim()}|${(province || "").trim()}`;
  if (_plateCache.has(key)) return _plateCache.get(key);
  const data = await checkPlate({ plate, province });
  const value = {
    exists: !!data?.exists,
    role: data?.role ?? null,
    plate: data?.plate ?? plate,
    province: data?.province ?? province,
  };
  _plateCache.set(key, value);
  return value;
}
