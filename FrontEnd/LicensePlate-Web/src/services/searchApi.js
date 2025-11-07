const BASE = "http://127.0.0.1:8000";

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function sendJson(url, method, body) {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  try { return await r.json(); } catch { return {}; }
}

// ดึงสมาชิกทั้งหมด (backend ของคุณไม่มี query filter -> กรองฝั่ง frontend)
export async function getMembers() {
  return getJson(`${BASE}/members`);
}

// อัปเดตเฉพาะข้อมูลสมาชิก (ไม่รวมป้ายทะเบียน)
export async function updateMember(memberId, payload) {
  // payload ต้องใช้คีย์ที่ backend ต้องการ: firstname, lastname, std_id
  return sendJson(`${BASE}/members/${memberId}`, "PUT", {
    firstname: payload.firstname,
    lastname:  payload.lastname,
    std_id:    payload.std_id,
  });
}

// ลบสมาชิก
export async function deleteMember(memberId) {
  const res = await fetch(`http://127.0.0.1:8000/members/${memberId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail || `Delete failed (${res.status})`);
  }
  return res.json();
}

