// src/components/ExportModal.jsx
import { useEffect, useMemo, useState } from "react";
import { formatThaiDateTime } from "../utils/date";
import { fetchEvents, fetchMembers } from "../services/api";
const API = (
  import.meta.env?.VITE_API_BASE_URL || "https://license-plate-recognition-wlxn.onrender.com"
).replace(/\/$/, "");

/* ===== Helpers เหมือนฝั่ง Search + join member ===== */
function isInsideRole(role) {
  const r = String(role || "").trim();
  const rl = r.toLowerCase();
  if (["นักศึกษา", "อาจารย์", "เจ้าหน้าที่"].includes(r)) return true;
  if (["staff", "employee", "internal", "insider"].includes(rl)) return true;
  return false;
}

function toThaiDirection(v) {
  const s = String(v || "").toUpperCase();
  if (s === "IN") return "เข้า";
  if (s === "OUT") return "ออก";
  if (s === "UNKNOWN") return "ไม่ทราบ";
  return s || "-";
}

// ใช้ plate + province เป็น key สำหรับ join Events ↔ Members
function makePlateKey(plate, province) {
  const p = String(plate || "").replace(/\s+/g, "").toUpperCase();
  const prov = String(province || "").trim();
  return `${p}|${prov}`;
}

const HEADER_LABELS = {
  timestamp: "เวลา (Timestamp)",
  plate: "ป้ายทะเบียน (Plate)",
  province: "จังหวัด (Province)",
  status: "สถานะ (Status)",
  userType: "ประเภทผู้ใช้ (User Type)",
  name: "ชื่อ (Name)",
};

function escapeCsv(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const EXPORT_MAX = 3000;
function computeExportLimit(start, end) {
  if (start && end) {
    const ms = new Date(end) - new Date(start);
    const days = Math.max(1, Math.round(ms / 86400000) + 1);
    return Math.min(EXPORT_MAX, days * 300); // ประมาณ 300 รายการ/วัน
  }
  return EXPORT_MAX;
}

/** เพิ่ม/ลดวันที่แบบง่าย ๆ (รับ "YYYY-MM-DD" คืนค่า string เดิมถ้า parse ไม่ได้) */
function addDays(dateStr, delta) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** เช็กว่า event อยู่ในช่วงวันที่ (ตามเวลาไทย) ที่ผู้ใช้เลือกหรือไม่ */
function isEventInLocalRange(ev, startDate, endDate) {
  if (!startDate && !endDate) return true;
  const iso = ev.time || ev.datetime;
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;

  const localYMD = d.toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  }); // "YYYY-MM-DD"

  if (startDate && localYMD < startDate) return false;
  if (endDate && localYMD > endDate) return false;
  return true;
}

/* ===== Date presets ===== */
function getTodayRange() {
  const d = new Date();
  const s = d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  return { start: s, end: s };
}
function getYesterdayRange() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const s = d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  return { start: s, end: s };
}
function getThisWeekRange() {
  const d = new Date();
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - diffToMonday);
  const s = start.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const e = d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  return { start: s, end: e };
}
function getThisMonthRange() {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const s = start.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const e = end.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  return { start: s, end: e };
}

/* ===== Component ===== */
export default function ExportModal({ open, onClose, defaultFilters = {} }) {
  const [preset, setPreset] = useState("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [direction, setDirection] = useState("all");
  const [userType, setUserType] = useState("all"); // all | inside | outside
  const [query, setQuery] = useState("");

  const [columns, setColumns] = useState({
    timestamp: true,
    plate: true,
    province: true,
    status: true,
    userType: true,
    name: true,
  });

  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const today = getTodayRange();

    setPreset("today");
    setStartDate(defaultFilters.start || today.start);
    setEndDate(defaultFilters.end || today.end);
    setDirection(defaultFilters.direction || "all");
    setUserType(defaultFilters.userType || "all");
    setQuery(defaultFilters.query || "");
    setError("");
  }, [open, defaultFilters]);

  const columnsSelected = useMemo(
    () => Object.values(columns).some(Boolean),
    [columns]
  );

  const handleToggleColumn = (key) => {
    setColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleClose = () => {
    if (isExporting) return;
    onClose?.();
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError("");

      if (!startDate || !endDate) {
        setError("กรุณาเลือกช่วงวันที่ให้ครบ");
        return;
      }
      if (!columnsSelected) {
        setError("กรุณาเลือกอย่างน้อย 1 คอลัมน์");
        return;
      }

      // ===== 1) แปลงช่วงวันที่สำหรับ API (ขยาย ±1 วัน เพื่อกัน timezone) =====
      const apiStart = addDays(startDate, -1);
      const apiEnd = addDays(endDate, 1);

      const evParams = new URLSearchParams();
      evParams.set("start_date", apiStart);
      evParams.set("end_date", apiEnd);
      if (direction && direction !== "all") {
        evParams.set("direction", direction);
      }
      if (query.trim()) {
        evParams.set("query", query.trim());
      }
      evParams.set("limit", String(computeExportLimit(apiStart, apiEnd)));

      // 2) ดึง events + members พร้อมกัน
const [eventsRaw, membersRaw] = await Promise.all([
  fetchEvents({
    start: apiStart,
    end: apiEnd,
    direction: direction === "all" ? undefined : direction,
    query: query.trim() || undefined,
    limit: computeExportLimit(apiStart, apiEnd),
  }),
  fetchMembers(),
]);

let events = Array.isArray(eventsRaw) ? eventsRaw : [];
let members = Array.isArray(membersRaw) ? membersRaw : [];


      // ===== 2.5) กรองช่วงวันที่อีกทีตาม "วันที่ไทย" ที่ผู้ใช้เลือก =====
      events = events.filter((e) =>
        isEventInLocalRange(e, startDate, endDate)
      );

      // 3) ทำ map plate+province -> member
      const memberMap = new Map();
      members.forEach((m) => {
        const key = makePlateKey(m.plate, m.province);
        if (key && !memberMap.has(key)) {
          memberMap.set(key, m);
        }
      });

      // 4) map events -> rows สำหรับ CSV พร้อมหา member / ภายใน-ภายนอก
      const exportRows = [];

      events.forEach((e) => {
        const key = makePlateKey(e.plate, e.province);
        const member = memberMap.get(key);

        const insideByRole = isInsideRole(e.role);
        const inside = insideByRole || !!member;

        // filter ตาม userType ที่เลือก
        if (userType === "inside" && !inside) return;
        if (userType === "outside" && inside) return;

        let name = "ไม่ทราบชื่อ";
        if (member) {
          const full = `${member.firstname || ""} ${member.lastname || ""}`.trim();
          if (full) name = full;
        } else if (inside) {
          name = "ไม่ทราบชื่อ";
        }

        const row = {
          timestamp: formatThaiDateTime(e.time || e.datetime),
          plate: e.plate || "-",
          province: e.province || "-",
          status: e.status || toThaiDirection(e.direction),
          userType: inside ? "บุคคลภายใน" : "บุคคลภายนอก",
          name,
        };

        exportRows.push(row);
      });

      // 5) สร้าง CSV ตามคอลัมน์ที่เลือก
      const selectedCols = Object.entries(columns)
        .filter(([, v]) => v)
        .map(([k]) => k);

      let csv = "\uFEFF"; // BOM ให้ Excel อ่านไทยได้
      csv +=
        selectedCols
          .map((col) => escapeCsv(HEADER_LABELS[col] || col))
          .join(",") + "\r\n";

      exportRows.forEach((row) => {
        csv +=
          selectedCols.map((col) => escapeCsv(row[col] ?? "")).join(",") +
          "\r\n";
      });

      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const now = new Date();
      const filename = `events_export_${now
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-")}.csv`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      handleClose();
    } catch (err) {
      console.error(err);
      setError("ไม่สามารถส่งออกไฟล์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40"
      onMouseDown={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            ส่งออกรายงาน (Export CSV)
          </h2>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            onClick={handleClose}
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4 text-sm text-slate-800">
          {/* Date range */}
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-600">
              ช่วงวันที่ (Date Range)
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {[
                ["today", "วันนี้", getTodayRange],
                ["yesterday", "เมื่อวาน", getYesterdayRange],
                ["week", "สัปดาห์นี้", getThisWeekRange],
                ["month", "เดือนนี้", getThisMonthRange],
              ].map(([key, label, fn]) => (
                <button
                  key={key}
                  type="button"
                  className={
                    "rounded-full border px-3 py-1 text-xs " +
                    (preset === key
                      ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                      : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100")
                  }
                  onClick={() => {
                    setPreset(key);
                    const r = fn();
                    setStartDate(r.start);
                    setEndDate(r.end);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs text-slate-500">วันที่เริ่มต้น</div>
                <input
                  type="date"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-500">วันที่สิ้นสุด</div>
                <input
                  type="date"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Status / Direction */}
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-600">
              สถานะ (Status)
            </div>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option value="all">ทั้งหมด (All)</option>
              <option value="IN">เข้า (IN)</option>
              <option value="OUT">ออก (OUT)</option>
              <option value="UNKNOWN">ไม่ทราบ (Unknown)</option>
            </select>
          </div>

          {/* User type */}
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-600">
              ประเภทผู้ใช้ (User Type)
            </div>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={userType}
              onChange={(e) => setUserType(e.target.value)}
            >
              <option value="all">ทั้งหมด (All)</option>
              <option value="inside">บุคคลภายใน</option>
              <option value="outside">บุคคลภายนอก</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-600">
              ค้นหา (ป้ายทะเบียน / ชื่อ)
            </div>
            <input
              type="text"
              placeholder="เช่น 9กข 1234 หรือ สมชาย..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Columns */}
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-600">
              คอลัมน์ที่จะส่งออก (Select Columns)
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={columns.timestamp}
                  onChange={() => handleToggleColumn("timestamp")}
                />
                <span>เวลา (Timestamp)</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={columns.plate}
                  onChange={() => handleToggleColumn("plate")}
                />
                <span>ป้ายทะเบียน (Plate)</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={columns.province}
                  onChange={() => handleToggleColumn("province")}
                />
                <span>จังหวัด (Province)</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={columns.status}
                  onChange={() => handleToggleColumn("status")}
                />
                <span>สถานะ (Status)</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={columns.userType}
                  onChange={() => handleToggleColumn("userType")}
                />
                <span>ประเภทผู้ใช้ (User Type)</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={columns.name}
                  onChange={() => handleToggleColumn("name")}
                />
                <span>ชื่อ (Name)</span>
              </label>
            </div>
          </div>

          {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-3">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleClose}
            disabled={isExporting}
          >
            ยกเลิก (Cancel)
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleExport}
            disabled={isExporting || !columnsSelected}
          >
            {isExporting ? "กำลังส่งออก..." : "ส่งออก (Export)"}
          </button>
        </div>
      </div>
    </div>
  );
}
