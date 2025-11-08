export const API =
  (import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

// ตัวช่วยจัดการ response ให้โยน error ที่อ่านรู้เรื่อง
async function handle(res) {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const text = await res.text();
      try {
        const j = JSON.parse(text);
        msg = j.detail || j.message || text || msg;
      } catch {
        msg = text || msg;
      }
    } catch {}
    throw new Error(msg);
  }
  try {
    return await res.json();
  } catch {
    return {};
  }
}

// ---------- API ----------

// ดึงสมาชิกทั้งหมด
export async function getMembers() {
  return handle(await fetch(`${API}/members`));
}

// อัปเดตเฉพาะข้อมูลสมาชิก (ไม่รวมป้ายทะเบียน)
export async function updateMember(memberId, payload) {
  const body = {
    firstname: payload.firstname,
    lastname:  payload.lastname,
    std_id:    payload.std_id,
  };
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
  return handle(
    await fetch(`${API}/members/${memberId}`, { method: "DELETE" })
  );
}

// สมัครสมาชิกพร้อมรถ (POST /register)
export async function registerMemberWithVehicle(body) {
  return handle(
    await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}