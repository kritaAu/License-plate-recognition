// ===== BASE URL / WS URL =====
export const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export const EVENTS_WS_URL =
  (import.meta.env?.VITE_WS_URL || API_BASE_URL.replace(/^http/i, "ws")) +
  "/ws/events";

// ===== shared helpers =====

// จัดการ response + error ของ FastAPI ให้เป็นข้อความอ่านง่าย
async function handle(res) {
  if (res.ok) {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }

  let msg = `HTTP ${res.status}`;
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      if (Array.isArray(j.detail)) {
        msg = j.detail
          .map((e) => e.msg || e.detail || JSON.stringify(e))
          .join(" | ");
      } else {
        msg = j.detail || j.message || text || msg;
      }
    } catch {
      msg = text || msg;
    }
  } catch {
    // ignore
  }
  throw new Error(msg);
}

const clean = (obj) =>
  Object.fromEntries(
    Object.entries(obj || {}).filter(
      ([, v]) => v !== "" && v !== null && v !== undefined
    )
  );

const numify = (v) =>
  typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;

// helper ยิง REST API แบบใช้ base URL + handle() ร่วมกัน
async function apiFetch(path, options = {}) {
  const { params, ...fetchOptions } = options;

  // ต่อ URL ให้ครบ
  let url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  // แนบ query string จาก params (กรองค่าว่างออกเหมือน clean())
  if (params && Object.keys(params).length) {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(
          ([, v]) => v !== "" && v !== null && v !== undefined
        )
      )
    );
    const qsStr = qs.toString();
    if (qsStr) {
      url += (url.includes("?") ? "&" : "?") + qsStr;
    }
  }

  const res = await fetch(url, {
    cache: "no-store",
    ...fetchOptions,
  });

  return handle(res);
}


// ===== EVENTS =====

// สร้าง query string สำหรับ /events
export function buildEventsQuery({
  start, // YYYY-MM-DD
  end, // YYYY-MM-DD
  direction, // "IN" | "OUT" | "UNKNOWN" | "all"
  query, // ทะเบียน
  limit, // number
} = {}) {
  const p = new URLSearchParams();

  if (start) p.set("start_date", start);
  if (end) p.set("end_date", end);
  if (direction && direction !== "all") p.set("direction", direction);
  if (query) p.set("query", query);
  if (limit != null) p.set("limit", String(limit));

  return p.toString();
}

// ดึงรายการ events (คืนค่าเป็น “raw events” ตาม backend)
export async function fetchEvents(params = {}, { signal } = {}) {
  const qs = buildEventsQuery(params);
  const url = qs ? `${API_BASE_URL}/events?${qs}` : `${API_BASE_URL}/events`;

  const res = await fetch(url, {
    cache: "no-store",
    signal,
  });
  return handle(res); // ปกติจะได้เป็น array
}

// ดึง events ของวันเดียวแบบเร็ว ๆ (ใช้ logic ใกล้กับ dashboardApi เดิม)
export async function fetchEventsForDay(dateStr, limit = 10000) {
  // dateStr: "YYYY-MM-DD" ถ้าไม่ส่ง จะใช้วันนี้แบบ local
  const pad2 = (n) => String(n).padStart(2, "0");
  let day = dateStr;
  if (!day) {
    const now = new Date();
    day = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
      now.getDate()
    )}`;
  }

  const qs = buildEventsQuery({ start: day, end: day, limit });
  const res = await fetch(`${API_BASE_URL}/events?${qs}`, {
    cache: "no-store",
  });
  const rows = await handle(res);

  // แปลงให้ field ที่มักใช้ในหน้า Dashboard ครบ ๆ
  return (Array.isArray(rows) ? rows : []).map((e) => ({
    ...e,
    datetime: e.datetime || e.time || null,
    direction:
      e.direction ||
      (e.status === "เข้า"
        ? "in"
        : e.status === "ออก"
        ? "out"
        : e.direction || ""),
    role:
      e.role ||
      (String(e.check || "").includes("ภายใน") ? "internal" : "visitor"),
    image: e.image || e.imgUrl || e.blob || null,
    blob: e.blob || e.image || e.imgUrl || null,
  }));
}
// ===== PARKING SESSIONS (Session Log) =====

function buildParkingSessionsQuery({
  status = "all", // "all" | "parked" | "completed" | "unmatched"
  start, // YYYY-MM-DD
  end, // YYYY-MM-DD
  limit, // number
} = {}) {
  const p = new URLSearchParams();
  if (status && status !== "all") p.set("status", status);
  if (start) p.set("start_date", start);
  if (end) p.set("end_date", end);
  if (limit != null) p.set("limit", String(limit));
  return p.toString();
}

export async function fetchParkingSessions(params = {}, { signal } = {}) {
  const qs = buildParkingSessionsQuery(params);
  const url = qs
    ? `${API_BASE_URL}/api/parking-sessions?${qs}`
    : `${API_BASE_URL}/api/parking-sessions`;

  const res = await fetch(url, {
    cache: "no-store",
    signal,
  });
  return handle(res); // backend คืน array ของ session อยู่แล้ว
}

// ===== MEMBERS =====

// ดึงสมาชิกทั้งหมด
export async function fetchMembers() {
  const res = await fetch(`${API_BASE_URL}/members`);
  return handle(res);
}

// อัปเดตสมาชิก (ไม่รวมป้ายทะเบียน)
export async function updateMember(memberId, payload) {
  const body = clean({
    firstname: payload.firstname?.trim(),
    lastname: payload.lastname?.trim(),
    std_id:
      payload.std_id === "" || payload.std_id == null
        ? undefined
        : numify(String(payload.std_id).trim()),
  });

  const res = await fetch(`${API_BASE_URL}/members/${memberId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle(res);
}

// ลบสมาชิก
export async function deleteMember(memberId) {
  const res = await fetch(`${API_BASE_URL}/members/${memberId}`, {
    method: "DELETE",
  });
  return handle(res);
}

// สมัครสมาชิกพร้อมรถ
export async function registerMemberWithVehicle(data) {
  const member = clean({
    firstname: data.member?.firstname?.trim(),
    lastname: data.member?.lastname?.trim(),
    role: data.member?.role, // "นักศึกษา" | "อาจารย์" | "เจ้าหน้าที่" | ...
    std_id:
      data.member?.std_id === "" || data.member?.std_id == null
        ? undefined
        : numify(String(data.member.std_id).trim()),
    faculty: data.member?.faculty?.trim(),
    major: data.member?.major?.trim(),
  });

  const vehicle = clean({
    plate: data.vehicle?.plate?.trim(),
    province: data.vehicle?.province?.trim(),
  });

  const res = await fetch(`${API_BASE_URL}/members/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ member, vehicle }),
  });
  return handle(res);
}


// ===== check plate (option) =====
const _plateCache = new Map();

/**
 * ใช้ /members แทน /check_plate
 * - รับ plate (และ province ไว้ใช้ filter ฝั่ง frontend)
 * - คืน object ที่มี role / member_name / member_department ฯลฯ
 */
export async function checkPlate(plate, province) {
  if (!plate) return null;

  try {
    // ใช้ apiFetch ที่ประกาศไว้ด้านบน เพื่อให้ใช้ BASE_URL + handle() ร่วมกัน
    const res = await apiFetch("/members", {
      params: { plate }, // backend รองรับค้นหาจากป้ายทะเบียน
    });

    const rows = Array.isArray(res) ? res : res?.data || [];
    if (!rows.length) return null;

    // ถ้ามี province ให้ลองเลือกตัวที่จังหวัดตรงกันก่อน
    const trimmedProvince = (province || "").trim();
    let m =
      (trimmedProvince &&
        rows.find(
          (r) =>
            (r.province || "").trim() === trimmedProvince
        )) ||
      rows[0];

    const fullName = [m.firstname, m.lastname]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      exists: true,
      role: m.role || null,
      plate: m.plate || plate || "",
      province: m.province || province || "",
      member_name: fullName || null,
      member_department: m.major || m.faculty || null,
    };
  } catch (err) {
    console.error("checkPlate error", err);
    return null;
  }
}

/**
 * มี cache ใน memory เพื่อลดการยิงซ้ำ
 */
export async function checkPlateCached(plate, province) {
  const key = `${(plate || "").trim()}|${(province || "").trim()}`;

  // ถ้ามีใน cache แล้วก็ใช้เลย
  if (_plateCache.has(key)) {
    return _plateCache.get(key);
  }

  // ตอนนี้ไปดึงจาก /members ผ่าน checkPlate ด้านบน
  const data = await checkPlate(plate, province);

  const normalizedPlate = (data?.plate ?? plate ?? "").toString().trim();
  const normalizedProvince = (data?.province ?? province ?? "")
    .toString()
    .trim();

  const info = {
    exists: Boolean(data?.exists ?? !!data),
    role:
      data?.role ??
      data?.member_role ??
      data?.member_type ??
      null,
    plate: normalizedPlate,
    province: normalizedProvince,
    name:
      data?.member_name ??
      data?.full_name ??
      data?.name ??
      null,
    department:
      data?.member_department ??
      data?.department ??
      data?.dept ??
      null,
  };

  _plateCache.set(key, info);
  return info;
}

// ===== AUTH / DASHBOARD =====

// login → คืน data จาก backend ตรง ๆ (access_token, user, ...)
export async function login({ username, password }) {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return handle(res);
}

// /dashboard/daily?date=YYYY-MM-DD  → คืน array hourly stats
export async function fetchDashboardDaily(dateStr) {
  const pad2 = (n) => String(n).padStart(2, "0");
  let day = dateStr;
  if (!day) {
    const now = new Date();
    day = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
      now.getDate()
    )}`;
  }

  const res = await fetch(`${API_BASE_URL}/dashboard/daily?date=${day}`, {
    cache: "no-store",
  });
  return handle(res);
}
