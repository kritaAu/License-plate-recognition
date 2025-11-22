// src/components/RecordsTable.jsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/* ================= CONFIG ================= */
const API = (
  import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const PAGE_SIZE = 10;

// รายชื่อจังหวัดไทย (เอาไว้ autocomplete)
const THAI_PROVINCES = [
  "กรุงเทพมหานคร",
  "กระบี่",
  "กาญจนบุรี",
  "กาฬสินธุ์",
  "กำแพงเพชร",
  "ขอนแก่น",
  "จันทบุรี",
  "ฉะเชิงเทรา",
  "ชลบุรี",
  "ชัยนาท",
  "ชัยภูมิ",
  "ชุมพร",
  "เชียงราย",
  "เชียงใหม่",
  "ตรัง",
  "ตราด",
  "ตาก",
  "นครนายก",
  "นครปฐม",
  "นครพนม",
  "นครราชสีมา",
  "นครศรีธรรมราช",
  "นครสวรรค์",
  "นนทบุรี",
  "นราธิวาส",
  "น่าน",
  "บึงกาฬ",
  "บุรีรัมย์",
  "ปทุมธานี",
  "ประจวบคีรีขันธ์",
  "ปราจีนบุรี",
  "ปัตตานี",
  "พระนครศรีอยุธยา",
  "พะเยา",
  "พังงา",
  "พัทลุง",
  "พิจิตร",
  "พิษณุโลก",
  "เพชรบุรี",
  "เพชรบูรณ์",
  "แพร่",
  "ภูเก็ต",
  "มหาสารคาม",
  "มุกดาหาร",
  "ยะลา",
  "ยโสธร",
  "ระนอง",
  "ระยอง",
  "ราชบุรี",
  "ร้อยเอ็ด",
  "ลพบุรี",
  "ลำปาง",
  "ลำพูน",
  "เลย",
  "ศรีสะเกษ",
  "สกลนคร",
  "สงขลา",
  "สตูล",
  "สมุทรปราการ",
  "สมุทรสงคราม",
  "สมุทรสาคร",
  "สระบุรี",
  "สระแก้ว",
  "สิงห์บุรี",
  "สุโขทัย",
  "สุพรรณบุรี",
  "สุราษฎร์ธานี",
  "สุรินทร์",
  "หนองคาย",
  "หนองบัวลำภู",
  "อ่างทอง",
  "อำนาจเจริญ",
  "อุดรธานี",
  "อุตรดิตถ์",
  "อุทัยธานี",
  "อุบลราชธานี",
];

/* ================= HELPERS ================= */

// แปลงป้ายทะเบียนให้ใช้เทียบได้แบบไม่สนช่องว่าง / ขีด / ตัวเล็กตัวใหญ่
function normalizePlateKey(value = "") {
  return value
    .toString()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .toUpperCase();
}

// URL รูปจาก record / _raw
function getImageUrl(rec = {}) {
  return (
    rec.imgUrl ||
    rec.image ||
    rec.blob ||
    rec._raw?.imgUrl ||
    rec._raw?.image ||
    rec._raw?.blob ||
    null
  );
}

// ทิศทาง IN / OUT / UNKNOWN
function getDirection(rec = {}) {
  const rawDir = (rec._raw?.direction || rec.direction || "")
    .toString()
    .toUpperCase();
  const statusText = (rec.status || rec._raw?.status || "").toString();

  if (rawDir === "IN" || statusText.includes("เข้า")) return "IN";
  if (rawDir === "OUT" || statusText.includes("ออก")) return "OUT";
  return "UNKNOWN";
}

function getDirectionUI(rec = {}) {
  const dir = getDirection(rec);
  if (dir === "IN") {
    return {
      code: "IN",
      label: "เข้า (IN)",
      chipClass:
        "bg-emerald-50 text-emerald-700 border border-emerald-200",
    };
  }
  if (dir === "OUT") {
    return {
      code: "OUT",
      label: "ออก (OUT)",
      chipClass: "bg-rose-50 text-rose-700 border border-rose-200",
    };
  }
  return {
    code: "UNKNOWN",
    label: "ไม่ทราบ",
    chipClass: "bg-slate-50 text-slate-600 border border-slate-200",
  };
}

// คนใน / คนนอก / ไม่ทราบ
function getPersonType(rec = {}) {
  if (rec.personType === "inside" || rec.personType === "outside") {
    return rec.personType;
  }
  if (rec.person_type === "inside" || rec.person_type === "outside") {
    return rec.person_type;
  }

  const memberRole = rec.member_role || rec._raw?.member_role || "";
  const role = rec.role || rec._raw?.role || "";
  const chk = rec.check || rec._raw?.check || "";

  let text = "";
  if (memberRole) text = memberRole.toString().toLowerCase();
  else if (role) text = role.toString().toLowerCase();
  else if (chk) text = chk.toString().toLowerCase();

  if (
    text.includes("ภายใน") ||
    text.includes("internal") ||
    text.includes("นักศึกษา") ||
    text.includes("อาจารย์") ||
    text.includes("เจ้าหน้าที่")
  ) {
    return "inside";
  }

  if (
    text.includes("ภายนอก") ||
    text.includes("outside") ||
    text.includes("visitor")
  ) {
    return "outside";
  }

  return "unknown";
}

function getPersonTypeUI(rec = {}) {
  const type = getPersonType(rec);
  if (type === "inside") {
    return {
      type,
      label: "คนใน",
      chipClass: "bg-indigo-50 text-indigo-700 border border-indigo-200",
      iconBg: "bg-indigo-100 text-indigo-600",
      textClass: "text-indigo-600",
    };
  }
  if (type === "outside") {
    return {
      type,
      label: "คนนอก",
      chipClass: "bg-amber-50 text-amber-700 border border-amber-200",
      iconBg: "bg-amber-100 text-amber-600",
      textClass: "text-amber-600",
    };
  }
  return {
    type,
    label: "ไม่ทราบ",
    chipClass: "bg-slate-50 text-slate-600 border border-slate-200",
    iconBg: "bg-slate-100 text-slate-500",
    textClass: "text-slate-500",
  };
}

// แยกวันที่/เวลาแบบที่ใช้แสดงในตาราง
function splitDateTime(iso) {
  if (!iso) return { date: "", time: "" };
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return { date: "", time: iso };
    }
    const date = d.toLocaleDateString("en-CA", {
      timeZone: "Asia/Bangkok",
    }); // 2025-11-22
    const time = d.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Bangkok",
    });
    return { date, time: `${time} น.` };
  } catch {
    return { date: "", time: iso };
  }
}

// แปลงนาที → "รวม: 2 ชม. 30 น."
function formatDurationLabel(minutes) {
  if (minutes == null) return "";
  const m = Number(minutes);
  if (Number.isNaN(m) || m <= 0) return "รวม: 0 น.";

  const h = Math.floor(m / 60);
  const mm = m % 60;

  let label = "รวม: ";
  if (h) label += `${h} ชม. `;
  if (mm) label += `${mm} น.`;
  if (!h && !mm) label += "0 น.";
  return label.trim();
}

// province: ถ้าอย่างใดอย่างหนึ่งว่าง ให้ถือว่า "ไม่บังคับต้องเท่ากัน"
function isSameProvince(a, b) {
  const aa = (a || "").trim();
  const bb = (b || "").trim();
  if (!aa || !bb) return true;
  return aa === bb;
}

// แปลง record ให้เป็น session แบบเดียวกัน
function normalizeSession(rec = {}) {
  const raw = rec._raw || {};
  const dir = getDirection(rec);

  const fallbackTime =
    raw.datetime ||
    raw.time ||
    rec.datetime ||
    rec.time ||
    "";

  const entryTime =
    rec.entry_time ||
    raw.entry_time ||
    raw.checkin_time ||
    (dir === "IN" ? fallbackTime : "") ||
    "";

  const exitTime =
    rec.exit_time ||
    raw.exit_time ||
    raw.checkout_time ||
    (dir === "OUT" ? fallbackTime : "") ||
    "";

  const entryImage =
    rec.entry_image ||
    raw.entry_image ||
    raw.entry_img ||
    getImageUrl(rec) ||
    null;

  const exitImage =
    rec.exit_image ||
    raw.exit_image ||
    raw.exit_img ||
    getImageUrl(rec) ||
    null;

  const rawStatus = (rec.status || raw.status || "")
    .toString()
    .toLowerCase();

  let statusKey = "unknown";
  if (entryTime && exitTime) {
    statusKey = "completed";
  } else if (
    entryTime &&
    !exitTime &&
    (dir === "IN" || rawStatus === "parked")
  ) {
    statusKey = "parking"; // ยังจอดอยู่
  } else if (
    !entryTime &&
    exitTime &&
    (dir === "OUT" || rawStatus === "unmatched")
  ) {
    statusKey = "exit_only"; // มีแต่ข้อมูลออก
  } else if (entryTime && !exitTime && dir === "OUT") {
    statusKey = "entry_only";
  }

  const plate =
    rec.plate ||
    rec.plate_entry ||
    rec.plate_exit ||
    raw.plate ||
    raw.license_plate ||
    raw.plate_number_entry ||
    raw.plate_number_exit ||
    "ไม่ทราบป้ายทะเบียน";

  const province =
    rec.province ||
    rec.province_entry ||
    raw.province ||
    raw.plate_province ||
    "";

  let durationMinutes = null;
  if (typeof rec.duration_minutes === "number") {
    durationMinutes = rec.duration_minutes;
  } else if (typeof raw.duration_minutes === "number") {
    durationMinutes = raw.duration_minutes;
  }

  return {
    plate,
    province,
    entryTime,
    exitTime,
    entryImage,
    exitImage,
    direction: dir,
    statusKey,
    rawStatus,
    durationMinutes,
  };
}

function getSessionStatusUI(session) {
  const rawStatus = (session.rawStatus || "").toString().toLowerCase();
  const key = session.statusKey;

  if (rawStatus === "completed" || key === "completed") {
    return {
      label: "ออกแล้ว",
      chipClass:
        "bg-emerald-50 text-emerald-700 border border-emerald-200",
    };
  }
  if (rawStatus === "parked" || key === "parking") {
    return {
      label: "กำลังจอด",
      chipClass:
        "bg-amber-50 text-amber-700 border border-amber-200",
    };
  }
  if (rawStatus === "unmatched" || key === "exit_only") {
    return {
      label: "ไม่พบข้อมูลเข้า",
      chipClass: "bg-rose-50 text-rose-700 border border-rose-200",
    };
  }
  if (key === "entry_only") {
    return {
      label: "ไม่พบข้อมูลออก",
      chipClass: "bg-amber-50 text-amber-700 border border-amber-200",
    };
  }
  return {
    label: "ไม่ทราบ",
    chipClass: "bg-slate-50 text-slate-600 border border-slate-200",
  };
}

// ใช้หาตัว event_id จาก record / _raw
function getEventId(rec = {}) {
  return (
    rec._raw?.event_id ??
    rec._raw?.id ??
    rec.event_id ??
    rec.id ??
    null
  );
}

// ใช้หาตัว session_id ถ้า record มาจาก /api/parking-sessions
function getSessionId(rec = {}) {
  return rec.session_id ?? rec._raw?.session_id ?? null;
}

// จำกัดช่วงเวลาที่จะยอมจับคู่เข้า/ออก (24 ชม.)
const MAX_DIFF_MS = 1000 * 60 * 60 * 24;

// แปลงวันที่เป็น ms แบบปลอดภัย
function parseDateSafe(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}

// รวม record ขาเข้า + ขาออก ให้กลายเป็น session เดียว
function mergeEntryExitRecords(entryItem, exitItem) {
  const { rec: entryRec, session: entrySession, entryMs } = entryItem;
  const { rec: exitRec, session: exitSession, exitMs } = exitItem;

  const rawEntry = entryRec._raw || {};
  const rawExit = exitRec._raw || {};

  const entryTime =
    entrySession.entryTime ||
    entryRec.entry_time ||
    rawEntry.entry_time ||
    rawEntry.datetime ||
    entryRec.datetime ||
    entryRec.time ||
    "";

  const exitTime =
    exitSession.exitTime ||
    exitRec.exit_time ||
    rawExit.exit_time ||
    rawExit.datetime ||
    exitRec.datetime ||
    exitRec.time ||
    "";

  let durationMinutes =
    entryRec.duration_minutes ??
    exitRec.duration_minutes ??
    entrySession.durationMinutes ??
    exitSession.durationMinutes ??
    null;

  if (
    (durationMinutes == null || Number.isNaN(Number(durationMinutes))) &&
    entryMs != null &&
    exitMs != null &&
    exitMs >= entryMs
  ) {
    durationMinutes = Math.round((exitMs - entryMs) / 60000);
  }

  const mergedRaw = {
    ...rawEntry,
    ...rawExit,
    entry_time: entryTime,
    exit_time: exitTime,
    entry_image:
      entrySession.entryImage ||
      rawEntry.entry_image ||
      rawEntry.entry_img ||
      getImageUrl(entryRec) ||
      null,
    exit_image:
      exitSession.exitImage ||
      rawExit.exit_image ||
      rawExit.exit_img ||
      getImageUrl(exitRec) ||
      null,
    plate:
      entrySession.plate ||
      exitSession.plate ||
      rawEntry.plate ||
      rawExit.plate ||
      entryRec.plate ||
      entryRec.plate_entry ||
      exitRec.plate ||
      exitRec.plate_entry ||
      exitRec.plate_exit,
    license_plate:
      entrySession.plate ||
      exitSession.plate ||
      rawEntry.license_plate ||
      rawExit.license_plate,
    province:
      entrySession.province ||
      exitSession.province ||
      rawEntry.province ||
      rawExit.province ||
      entryRec.province ||
      exitRec.province,
    plate_province:
      entrySession.province ||
      exitSession.province ||
      rawEntry.plate_province ||
      rawExit.plate_province,
    status: "completed",
    duration_minutes: durationMinutes,
  };

  const merged = {
    ...entryRec,
    ...exitRec,
    _raw: mergedRaw,
    plate:
      mergedRaw.plate ??
      entrySession.plate ??
      exitSession.plate ??
      entryRec.plate ??
      exitRec.plate,
    plate_entry:
      entryRec.plate_entry ??
      exitRec.plate_entry ??
      mergedRaw.plate ??
      entrySession.plate ??
      exitSession.plate,
    plate_exit:
      exitRec.plate_exit ??
      entryRec.plate_exit ??
      mergedRaw.plate ??
      exitSession.plate ??
      entrySession.plate,
    province:
      mergedRaw.province ??
      entrySession.province ??
      exitSession.province ??
      entryRec.province ??
      exitRec.province,
    entry_time: entryTime,
    exit_time: exitTime,
    status: "completed",
    duration_minutes: durationMinutes,
  };

  return merged;
}

// ===== รวม rows เป็น session ตามป้ายทะเบียน =====
function buildSessionRows(records) {
  if (!Array.isArray(records) || records.length === 0) return [];

  // กันค่า null/undefined
  const list = records.filter((r) => r && typeof r === "object");

  // ถ้าเป็นข้อมูลจาก /api/parking-sessions อยู่แล้ว (ไม่มี _raw) ให้ใช้ตามเดิม
  const looksLikeSession = list.some(
    (r) =>
      r.session_id != null ||
      "entry_time" in r ||
      "exit_time" in r ||
      "plate_entry" in r ||
      "plate_exit" in r
  );
  const hasRaw = list.some((r) => r._raw);

  if (looksLikeSession && !hasRaw) {
    return list;
  }

  // เตรียม items พร้อมเวลาเข้า/ออก แล้ว "เรียงตามเวลาเก่า→ใหม่"
  const items = list
    .map((rec, index) => {
      const session = normalizeSession(rec);
      const entryMs = parseDateSafe(session.entryTime);
      const exitMs = parseDateSafe(session.exitTime);
      const mainMs = entryMs ?? exitMs ?? 0;
      return {
        rec,
        index,
        session,
        entryMs,
        exitMs,
        mainMs,
      };
    })
    .sort((a, b) => a.mainMs - b.mainMs);

  const used = new Set();
  const result = [];

  for (let i = 0; i < items.length; i += 1) {
    if (used.has(i)) continue;

    const item = items[i];
    const { session } = item;

    if (!session) {
      result.push(item.rec);
      continue;
    }

    const hasEntry = !!session.entryTime;
    const hasExit = !!session.exitTime;

    // ให้ถือว่าเป็น "ฝั่งเข้า" เมื่อมีเวลาเข้า แต่ไม่มีเวลาออก
    const entryLike =
      hasEntry &&
      !hasExit &&
      (session.direction === "IN" ||
        session.statusKey === "parking" ||
        session.statusKey === "entry_only");

    // ถ้าไม่ใช่ฝั่งเข้า (หรือเป็น session ที่มีเข้า/ออกครบอยู่แล้ว) → ไม่ต้องจับคู่
    if (!entryLike) {
      result.push(item.rec);
      continue;
    }

    const baseMs = item.entryMs;
    if (baseMs == null) {
      result.push(item.rec);
      continue;
    }

    const plateKey = normalizePlateKey(session.plate);
    const provinceKey = (session.province || "").trim();

    let partnerIndex = -1;

    // หา "ขาออก" แรกที่เวลา >= เวลาเข้า, ป้าย/จังหวัดตรงกัน, อยู่ใน 24 ชม.
    for (let j = i + 1; j < items.length; j += 1) {
      if (used.has(j)) continue;

      const other = items[j];
      const s2 = other.session;
      if (!s2) continue;

      const otherHasEntry = !!s2.entryTime;
      const otherHasExit = !!s2.exitTime;

      const exitLike =
        !otherHasEntry &&
        otherHasExit &&
        (s2.direction === "OUT" || s2.statusKey === "exit_only");

      if (!exitLike) continue;

      const plateKey2 = normalizePlateKey(s2.plate);
      const provinceKey2 = (s2.province || "").trim();

      if (plateKey2 !== plateKey) continue;
      if (!isSameProvince(provinceKey, provinceKey2)) continue;

      const exitMs = other.exitMs;
      if (exitMs == null) continue;

      const diff = exitMs - baseMs;
      if (diff < 0 || diff > MAX_DIFF_MS) continue;

      partnerIndex = j;
      break; // ใช้ตัวแรกที่เจอ เพราะ items ถูก sort ตามเวลาแล้ว
    }

    if (partnerIndex === -1) {
      result.push(item.rec);
      continue;
    }

    used.add(i);
    used.add(partnerIndex);

    const entryItem = item;
    const exitItem = items[partnerIndex];

    const merged = mergeEntryExitRecords(entryItem, exitItem);
    result.push(merged);
  }

  // จัดลำดับผลลัพธ์ให้ "รายการล่าสุด" อยู่บนสุด (ดูจาก exitTime ถ้ามี, ไม่งั้นดู entryTime)
  const sortedResult = result.slice().sort((a, b) => {
    const sa = normalizeSession(a);
    const sb = normalizeSession(b);

    const ta =
      parseDateSafe(sa.exitTime || sa.entryTime) ?? 0;
    const tb =
      parseDateSafe(sb.exitTime || sb.entryTime) ?? 0;

    // ใหม่สุดอยู่บน
    return tb - ta;
  });

  return sortedResult;
}

/* ================= MODAL PORTAL ================= */

function ModalPortal({ children }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

/* ================= DETAIL MODAL ================= */

function DetailModal({ record, onClose, onUpdated }) {
  const [plateInput, setPlateInput] = useState("");
  const [provinceInput, setProvinceInput] = useState("");
  const [showProvinceList, setShowProvinceList] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [fullImageTarget, setFullImageTarget] = useState(null); // "entry" | "exit" | null

  const session = normalizeSession(record);
  const dirUI = getDirectionUI(record);
  const personUI = getPersonTypeUI(record);

  const memberName =
    record.member_name ||
    record._raw?.member_name ||
    record._raw?.driver_name ||
    record._raw?.owner_name ||
    record._raw?.full_name ||
    record._raw?.name ||
    null;

  const rawPlate =
    record._raw?.plate ??
    record.plate ??
    record._raw?.license_plate ??
    record.plate_entry ??
    "";
  const rawProvince =
    record._raw?.province ??
    record.province ??
    record.province_entry ??
    "";

  const eventId = getEventId(record);
  const sessionId = getSessionId(record);

  useEffect(() => {
    setPlateInput(rawPlate || "");
    setProvinceInput(rawProvince || "");
    setErrorMsg("");
    setSuccessMsg("");
  }, [rawPlate, rawProvince, eventId, sessionId]);

  const trimmedPlate = plateInput.trim();
  const trimmedProvince = provinceInput.trim();

  const hasChanged =
    trimmedPlate !== (rawPlate || "").trim() ||
    trimmedProvince !== (rawProvince || "").trim();

  const provinceSuggestions = THAI_PROVINCES.filter((p) =>
    p.includes(trimmedProvince || "")
  ).slice(0, 6);

  async function handleSave() {
    try {
      setErrorMsg("");
      setSuccessMsg("");

      if (!hasChanged) {
        setErrorMsg("ยังไม่มีการเปลี่ยนแปลง");
        return;
      }

      if (!sessionId && !eventId) {
        setErrorMsg("ไม่พบข้อมูลสำหรับบันทึก");
        return;
      }

      setIsSaving(true);

      let url;
      let isSessionFix = false;

      if (sessionId) {
        const params = new URLSearchParams();
        if (trimmedPlate) params.set("correct_plate", trimmedPlate);
        if (trimmedProvince) params.set("correct_province", trimmedProvince);

        url = `${API}/api/parking-sessions/${sessionId}/fix-plate?${params.toString()}`;
        isSessionFix = true;
      } else if (eventId) {
        const params = new URLSearchParams();
        if (trimmedPlate) params.set("plate", trimmedPlate);
        if (trimmedProvince) params.set("province", trimmedProvince);

        url = `${API}/events/${eventId}?${params.toString()}`;
      }

      const res = await fetch(url, { method: "PATCH" });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const json = await res.json().catch(() => null);
      const data = json?.data || json || {};

      const updated = isSessionFix
        ? {
            plate:
              data.plate_number_entry ??
              trimmedPlate ??
              rawPlate,
            province:
              data.province ??
              trimmedProvince ??
              rawProvince,
            entry_time: data.entry_time,
            exit_time: data.exit_time,
            status: data.status,
          }
        : {
            plate: data.plate ?? trimmedPlate ?? rawPlate,
            province: data.province ?? trimmedProvince ?? rawProvince,
            datetime: data.datetime ?? record._raw?.datetime,
          };

      setSuccessMsg("บันทึกเรียบร้อยแล้ว");
      onUpdated?.(
        { eventId: eventId || null, sessionId: sessionId || null },
        updated
      );
    } catch (err) {
      console.error(err);
      setErrorMsg("บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSaving(false);
    }
  }

  const fullImageUrl =
    fullImageTarget === "entry"
      ? session.entryImage
      : fullImageTarget === "exit"
      ? session.exitImage
      : null;

  const entryParts = splitDateTime(session.entryTime);
  const exitParts = splitDateTime(session.exitTime);

  return (
    <>
      {/* overlay */}
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 py-6"
        onClick={onClose}
      >
        <div
          className="relative max-h-full w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <header className="flex items-start justify-between gap-4 border-b px-6 py-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-3">
                <div className="inline-flex items-center rounded-full bg-slate-900 px-4 py-1.5 text-base font-semibold tracking-wide text-slate-50">
                  <span>{session.plate || "ไม่ทราบป้ายทะเบียน"}</span>
                </div>
                {session.province && (
                  <span className="text-sm text-slate-500">
                    {session.province}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 font-medium ${personUI.chipClass}`}
                >
                  {personUI.label}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 font-medium ${dirUI.chipClass}`}
                >
                  {dirUI.label}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <span className="sr-only">ปิด</span>×
            </button>
          </header>

          {/* body main */}
          <div className="flex flex-col gap-6 px-6 py-4">
            {/* Entry / Exit panel */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Entry */}
              <div className="flex flex-col rounded-2xl border border-slate-100 bg-slate-50">
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      →
                    </span>
                    <div className="text-sm font-semibold text-slate-800">
                      ขาเข้า (Check-in)
                    </div>
                  </div>
                </div>
                <div className="px-4 pb-3">
                  <div className="relative overflow-hidden rounded-xl border border-dashed border-slate-200 bg-white">
                    <div className="aspect-video w-full bg-slate-100">
                      {session.entryImage ? (
                        <button
                          type="button"
                          className="flex h-full w-full items-center justify-center text-sm text-slate-500 hover:bg-slate-900/5"
                          onClick={() => setFullImageTarget("entry")}
                        >
                          <img
                            src={session.entryImage}
                            alt="Entry"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-slate-400">
                          <span>ยังไม่มีข้อมูลขาเข้า</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t bg-slate-950/90 px-3 py-1 text-[11px] text-slate-100">
                      <span>
                        {entryParts.time || "ไม่ได้บันทึกเวลาเข้า"}{" "}
                        {entryParts.date && `• ${entryParts.date}`}
                      </span>
                      {session.entryImage && (
                        <span className="text-emerald-300">
                          Entry Image
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Exit */}
              <div className="flex flex-col rounded-2xl border border-slate-100 bg-slate-50">
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                      ←
                    </span>
                    <div className="text-sm font-semibold text-slate-800">
                      ขาออก (Check-out)
                    </div>
                  </div>
                </div>
                <div className="px-4 pb-3">
                  <div className="relative overflow-hidden rounded-xl border border-dashed border-slate-200 bg-white">
                    <div className="aspect-video w-full bg-slate-100">
                      {session.exitImage ? (
                        <button
                          type="button"
                          className="flex h-full w-full items-center justify-center text-sm text-slate-500 hover:bg-slate-900/5"
                          onClick={() => setFullImageTarget("exit")}
                        >
                          <img
                            src={session.exitImage}
                            alt="Exit"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-slate-400">
                          <span>ยังไม่มีข้อมูลขาออก</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t bg-slate-950/90 px-3 py-1 text-[11px] text-slate-100">
                      <span>
                        {exitParts.time || "ไม่ได้บันทึกเวลาออก"}{" "}
                        {exitParts.date && `• ${exitParts.date}`}
                      </span>
                      {session.exitImage && (
                        <span className="text-amber-200">
                          Exit Image
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline + edit form */}
            <div className="grid gap-4 md:grid-cols-[minmax(0,2fr),minmax(0,1.4fr)]">
              {/* Timeline */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="text-lg">🕒</span>
                  <span>ไทม์ไลน์ (Timeline)</span>
                </div>

                <div className="flex items-center justify-between gap-4 text-xs">
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span>เวลาเข้า (Entry)</span>
                    </div>
                    <span className="font-medium text-slate-800">
                      {entryParts.time || "-"}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {entryParts.date || ""}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
                      {session.entryTime && session.exitTime
                        ? formatDurationLabel(session.durationMinutes)
                        : "--"}
                    </span>
                    <div className="mt-1 h-px w-full max-w-[220px] bg-gradient-to-r from-emerald-400 via-slate-300 to-rose-400" />
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                      <span>เวลาออก (Exit)</span>
                    </div>
                    <span className="font-medium text-slate-800">
                      {exitParts.time || "-"}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {exitParts.date || ""}
                    </span>
                  </div>
                </div>
              </div>

              {/* Edit form */}
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                <div className="mb-2 text-sm font-semibold text-slate-700">
                  แก้ไขข้อมูล
                </div>

                <div className="space-y-3 text-xs">
                  {/* ป้ายทะเบียน */}
                  <label className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-slate-500">
                      ป้ายทะเบียน
                    </span>
                    <input
                      type="text"
                      value={plateInput}
                      onChange={(e) => setPlateInput(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      placeholder="เช่น 3กข 1234"
                    />
                  </label>

                  {/* จังหวัด + suggestion */}
                  <div className="flex items-start gap-2">
                    <span className="w-20 shrink-0 pt-2 text-slate-500">
                      จังหวัด
                    </span>
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={provinceInput}
                        onChange={(e) => {
                          setProvinceInput(e.target.value);
                          setShowProvinceList(true);
                        }}
                        onFocus={() => setShowProvinceList(true)}
                        onBlur={() =>
                          setTimeout(
                            () => setShowProvinceList(false),
                            150
                          )
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                        placeholder="เลือกจังหวัด"
                      />
                      {showProvinceList &&
                        trimmedProvince &&
                        provinceSuggestions.length > 0 && (
                          <div className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white text-xs shadow-lg">
                            {provinceSuggestions.map((p) => (
                              <button
                                key={p}
                                type="button"
                                className="block w-full px-3 py-1.5 text-left hover:bg-sky-50"
                                onClick={() => {
                                  setProvinceInput(p);
                                  setShowProvinceList(false);
                                }}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>

                                    {/* สถานะคนใน/คนนอก + ชื่อ (ถ้ามี) */}
                  <div className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-slate-500">
                      สถานะ
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${personUI.chipClass}`}
                      >
                        {personUI.label}
                      </span>
                      {personUI.type === "inside" && memberName && (
                        <span className="text-[11px] text-slate-500">
                          {memberName}
                        </span>
                      )}
                    </div>
                  </div>


                  {errorMsg && (
                    <p className="text-xs text-red-600">{errorMsg}</p>
                  )}
                  {successMsg && (
                    <p className="text-xs text-emerald-600">
                      {successMsg}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    ปิด
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* full image overlay */}
      {fullImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setFullImageTarget(null)}
        >
          <img
            src={fullImageUrl}
            alt="Full"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
          />
        </div>
      )}
    </>
  );
}

/* ================= TABLE ================= */

function Th({ children }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return (
    <td
      className={`whitespace-nowrap px-4 py-4 align-top text-sm text-slate-700 ${className}`}
    >
      {children}
    </td>
  );
}

export default function RecordsTable({ records }) {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // sync rows กับ props (รวมคู่เข้า/ออกใหม่ทุกครั้งเมื่อ records เปลี่ยน)
  useEffect(() => {
    const list = Array.isArray(records) ? records : [];
    const merged = buildSessionRows(list);
    setRows(merged);
    setCurrentPage(1);
  }, [records]);

  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-slate-500">
        ไม่พบข้อมูล
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(startIndex, startIndex + PAGE_SIZE);

  function getPageNumbers(current, total) {
    const windowSize = 5;
    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + windowSize - 1);
    if (end - start < windowSize - 1) {
      start = Math.max(1, end - windowSize + 1);
    }
    const pages = [];
    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }
    return pages;
  }

  const pageNumbers = getPageNumbers(safePage, totalPages);

  const handleRecordUpdated = (key, updated) => {
    // อัปเดตในตาราง
    setRows((prev) =>
      prev.map((rec) => {
        const recEventId = getEventId(rec);
        const recSessionId = getSessionId(rec);

        const matchBySession =
          key.sessionId != null && recSessionId === key.sessionId;
        const matchByEvent =
          key.eventId != null && recEventId === key.eventId;

        if (!matchBySession && !matchByEvent) return rec;

        const newRaw = { ...(rec._raw || {}), ...updated };

        return {
          ...rec,
          ...updated,
          plate: updated.plate ?? rec.plate,
          province: updated.province ?? rec.province,
          _raw: newRaw,
        };
      })
    );

    // อัปเดตใน modal ถ้ากำลังเปิดอยู่ record เดียวกัน
    setSelected((prev) => {
      if (!prev) return prev;
      const recEventId = getEventId(prev);
      const recSessionId = getSessionId(prev);

      const matchBySession =
        key.sessionId != null && recSessionId === key.sessionId;
      const matchByEvent =
        key.eventId != null && recEventId === key.eventId;

      if (!matchBySession && !matchByEvent) return prev;

      const newRaw = { ...(prev._raw || {}), ...updated };

      return {
        ...prev,
        ...updated,
        plate: updated.plate ?? prev.plate,
        province: updated.province ?? prev.province,
        _raw: newRaw,
      };
    });
  };

  return (
    <>
      <div className="overflow-x-auto bg-white">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <Th>ประเภท</Th>
              <Th>ทะเบียนรถ</Th>
              <Th>ขาเข้า (CHECK-IN)</Th>
              <Th>ขาออก (CHECK-OUT)</Th>
              <Th>สถานะ</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {pageRows.map((rec, idx) => {
              const key =
                rec._raw?.id ||
                rec._raw?._id ||
                rec.session_id ||
                `${rec.time || ""}-${rec.plate || ""}-${startIndex + idx}`;

              const personUI = getPersonTypeUI(rec);
              const session = normalizeSession(rec);
              const statusUI = getSessionStatusUI(session);
              const entryParts = splitDateTime(session.entryTime);
              const exitParts = splitDateTime(session.exitTime);
              const durationLabel = formatDurationLabel(
                session.durationMinutes
              );

              const hasExit = !!session.exitTime;

              return (
                <tr
                  key={key}
                  className="cursor-pointer bg-white hover:bg-sky-50"
                  onClick={() => setSelected(rec)}
                >
                  {/* ประเภท */}
                  <Td>
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${personUI.iconBg}`}
                      >
                        <span className="text-lg">👤</span>
                      </div>
                      <span
                        className={`text-xs font-semibold ${personUI.textClass}`}
                      >
                        {personUI.label}
                      </span>
                    </div>
                  </Td>

                  {/* ทะเบียนรถ */}
                  <Td>
                    <div className="flex flex-col gap-1">
                      <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-base font-semibold tracking-wide text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                        {session.plate || "-"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {session.province || "ไม่ทราบจังหวัด"}
                      </div>
                    </div>
                  </Td>

                  {/* ขาเข้า */}
                  <Td className="w-[320px]">
                    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3">
                      <div className="flex h-16 w-24 items-center justify-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-500 shadow-sm">
                        Entry Img
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1 text-xs">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[11px] text-emerald-600">
                            →
                          </span>
                          <span className="font-semibold text-emerald-600">
                            เข้า
                          </span>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {entryParts.time || "-"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {entryParts.date || ""}
                        </div>
                      </div>
                    </div>
                  </Td>

                  {/* ขาออก */}
                  <Td className="w-[320px]">
                    {hasExit ? (
                      <div className="flex flex-col gap-1 rounded-2xl bg-slate-50 px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-16 w-24 items-center justify-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-500 shadow-sm">
                            Exit Img
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1 text-xs">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-[11px] text-rose-600">
                                ←
                              </span>
                              <span className="font-semibold text-rose-600">
                                ออก
                              </span>
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">
                              {exitParts.time || "-"}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {exitParts.date || ""}
                            </div>
                          </div>
                        </div>

                        {durationLabel && (
                          <div className="mt-1 inline-flex max-w-max rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
                            {durationLabel}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-16 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 text-xs font-medium text-slate-400">
                        ยังไม่มีข้อมูลออก
                      </div>
                    )}
                  </Td>

                  {/* สถานะ */}
                  <Td>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusUI.chipClass}`}
                    >
                      {statusUI.label}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-slate-600">
        <div>
          แสดง{" "}
          <span className="font-semibold">
            {startIndex + 1} -{" "}
            {Math.min(startIndex + PAGE_SIZE, rows.length)}
          </span>{" "}
          จาก{" "}
          <span className="font-semibold">{rows.length}</span> รายการ
        </div>

        <div className="flex items-center gap-1">
          {/* หน้าแรก */}
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            disabled={safePage === 1}
            className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            «
          </button>
          {/* ก่อนหน้า */}
          <button
            type="button"
            onClick={() =>
              setCurrentPage((p) => Math.max(1, p - 1))
            }
            disabled={safePage === 1}
            className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ‹
          </button>

          {/* เลขหน้า */}
          {pageNumbers.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setCurrentPage(p)}
              className={`min-w-[2rem] rounded border px-2 py-1 text-center text-xs ${
                p === safePage
                  ? "border-sky-500 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ))}

          {/* ถัดไป */}
          <button
            type="button"
            onClick={() =>
              setCurrentPage((p) => Math.min(totalPages, p + 1))
            }
            disabled={safePage === totalPages}
            className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ›
          </button>
          {/* หน้าสุดท้าย */}
          <button
            type="button"
            onClick={() => setCurrentPage(totalPages)}
            disabled={safePage === totalPages}
            className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            »
          </button>
        </div>
      </div>

      {/* detail modal */}
      {selected && (
        <ModalPortal>
          <DetailModal
            record={selected}
            onClose={() => setSelected(null)}
            onUpdated={handleRecordUpdated}
          />
        </ModalPortal>
      )}
    </>
  );
}
