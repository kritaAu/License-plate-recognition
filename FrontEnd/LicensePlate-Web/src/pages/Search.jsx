<<<<<<< Updated upstream
// src/pages/Search.jsx (ฉบับแก้ไขที่สมบูรณ์)
import { useEffect, useState, useRef } from "react"; // ===== MODIFIED: เพิ่ม useRef =====
=======
// src/pages/Search.jsx
import { useEffect, useRef, useState } from "react";
>>>>>>> Stashed changes
import Filters from "../components/Filters";
import RecordsTable from "../components/RecordsTable";
import { formatThaiDateTime } from "../utils/date";
import { downloadCsv } from "../utils/downloadCsv";

const API = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

<<<<<<< Updated upstream
// ===== ADDED: สร้าง WS_URL (เหมือนใน Home.jsx) =====
const WS_URL =
  (import.meta.env?.VITE_WS_URL || API_BASE.replace(/^http/i, "ws")) +
  "/ws/events";

// ===== ADDED: helper นี้จำเป็นสำหรับแปลง 'role' จาก WS (เหมือนใน Home.jsx) =====
function isInsideRole(role) {
  const r = String(role || "").trim();
  const rl = r.toLowerCase();
  if (["นักศึกษา", "อาจารย์", "เจ้าหน้าที่"].includes(r)) return true;
  if (["staff", "employee", "internal", "insider"].includes(rl)) return true;
  return false;
}

// แปลงทิศทางเป็นภาษาไทย
const toThaiDirection = (v) => {
  const s = String(v || "").toUpperCase();
  if (s === "IN") return "เข้า";
  if (s === "OUT") return "ออก";
  if (s === "UNKNOWN") return "ไม่ทราบ";
  return s || "-";
=======
/* ---------- helpers ---------- */
const buildQuery = (f) => {
  const p = new URLSearchParams();
  if (f.start) p.set("start_date", f.start);              // YYYY-MM-DD
  if (f.end) p.set("end_date", f.end);                    // YYYY-MM-DD
  if (f.direction && f.direction !== "all") p.set("direction", f.direction); // IN | OUT
  if (f.query) p.set("plate", f.query);                   // ค้นหาทะเบียน
  p.set("limit", "5000");
  return p.toString();
>>>>>>> Stashed changes
};

const mapRows = (raw) =>
  Array.isArray(raw)
    ? raw.map((e) => ({
        ...e,
        // ให้มี field time เสมอ และแปลงเป็น dd/mm/yyyy HH:MM:SS
        time: formatThaiDateTime(e.time || e.datetime),
      }))
    : [];

/* ---------- page ---------- */
export default function Search() {
  const [filters, setFilters] = useState({ start: "", end: "", direction: "all", query: "" });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

<<<<<<< Updated upstream
  // ===== ADDED: Refs สำหรับ WebSocket (เหมือนใน Home.jsx) =====
  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const stopRef = useRef(false);
=======
  const controllerRef = useRef(null);

  const load = async (f) => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();

    setLoading(true);
    try {
      const res = await fetch(`${API}/events?${buildQuery(f)}`, { signal: controllerRef.current.signal });
      if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
      const raw = await res.json();
      setRecords(mapRows(raw));
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error(err);
        setRecords([]);
      }
    } finally {
      setLoading(false);
    }
  };
>>>>>>> Stashed changes

  // โหลดครั้งแรก
  useEffect(() => {
    load(filters);
    // cleanup abort ตอนออกหน้า
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

<<<<<<< Updated upstream
  // ===== ADDED: WebSocket effect (เหมือนใน Home.jsx) =====
  useEffect(() => {
    stopRef.current = false;
    let retry = retryRef.current;

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
      };

      ws.onmessage = (ev) => {
        try {
          // 1. รับข้อมูลดิบจาก WS
          const data =
            typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
          if (!data?.datetime) return;

          // 2. แปลงข้อมูล (data) ให้อยู่ใน Format ที่ตาราง (RecordsTable) ต้องการ
          // (ต้องแปลงเอง เพราะข้อมูลจาก WS จะไม่เหมือนข้อมูลที่มาจาก /events)
          const check = isInsideRole(data.role) ? "บุคคลภายใน" : "บุคคลภายนอก";
          const newRecord = {
            time: formatThaiDateTime(data.datetime),
            plate: `${data.plate || "-"}${
              data.province ? " จ." + data.province : ""
            }`,
            status: toThaiDirection(data.direction),
            check: check,
            imgUrl: data.image || data.blob || null,
            _raw: data, // เก็บข้อมูลดิบไว้เผื่อ
          };

          // 3. อัปเดต State (เพิ่มรายการใหม่ไว้บนสุด)
          setRecords((prev) => [newRecord, ...prev]);
        } catch (e) {
          console.error("WS message processing error:", e);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        if (stopRef.current) return;
        const delay = Math.min(16000, 1000 * 2 ** Math.min(4, retry++));
        retryRef.current = retry;
        setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      stopRef.current = true;
      try {
        wsRef.current?.close();
      } catch {}
    };
  }, []); // [] = ทำงานครั้งเดียวเมื่อเปิดหน้านี้

  // กด “ใช้ฟิลเตอร์”
  const onApply = async () => {
    setLoading(true);
    const data = await fetchFilteredEvents(filters);
    // เมื่อกดค้นหา, เราจะ "แทนที่" ข้อมูลทั้งหมดด้วยผลลัพธ์ใหม่
    setRecords(data);
    setLoading(false);
  };
=======
  const onApply = () => load(filters);
>>>>>>> Stashed changes

  const onReset = () => {
    const f = { start: "", end: "", direction: "all", query: "" };
    setFilters(f);
<<<<<<< Updated upstream
    const data = await fetchFilteredEvents(f);
    // แทนที่ข้อมูลทั้งหมดด้วยผลลัพธ์ใหม่
    setRecords(data);
    setLoading(false);
=======
    load(f);
>>>>>>> Stashed changes
  };

  // export ตาม endpoint /export/events (รับ start/end/plate/direction)
  const onExport = async () => {
    const params = new URLSearchParams({
      start: filters.start || "",
      end: filters.end || "",
      direction: filters.direction !== "all" ? filters.direction : "",
      plate: filters.query || "",
    });
    await downloadCsv(`${API}/export/events?${params.toString()}`);
  };

  // ===== DELETED: โค้ด WS ที่ผิด 7 บรรทัดตรงนี้ถูกลบไปแล้ว =====

  return (
<<<<<<< Updated upstream
    // ===== MODIFIED: แก้ไข class (อาจจะพิมพ์ผิด) =====
    <div className="pt-0 bg-gradient-to-br from-white to-blue-400 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* แผงฟิลเตอร์ */}
        <div className="bg-slate-200/60 rounded-xl p-6">
          <Filters
            filters={filters}
            setFilters={setFilters}
            onApply={onApply}
            onReset={onReset}
            onExport={onExport}
          />
=======
    <div className="max-w-7xl mx-auto px-6 py-6 bg-gradient-to-tr from-white to-blue-400">
      <div className="bg-slate-200/60 rounded-xl p-6">
        <Filters
          filters={filters}
          setFilters={setFilters}
          onApply={onApply}
          onReset={onReset}
          onExport={onExport}
        />
      </div>

      <section className="mt-6 bg-white rounded-2xl border border-slate-100 shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">รายการล่าสุด</h3>
          <span className="text-sm text-slate-600">Items {records.length} items</span>
>>>>>>> Stashed changes
        </div>

        <RecordsTable records={records} />

        {loading && <div className="py-6 text-center text-sm text-slate-600">กำลังโหลด...</div>}
        {!loading && records.length === 0 && (
          <div className="py-6 text-center text-sm text-slate-600">ไม่พบข้อมูล</div>
        )}
      </section>
    </div>
  );
}
