// src/pages/Search.jsx 
import { useEffect, useState, useRef } from "react";
import Filters from "../components/Filters";
import RecordsTable from "../components/RecordsTable";
import { formatThaiDateTime } from "../utils/date";
import { downloadCsv } from "../utils/downloadCsv";

const API = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

// ===== WebSocket URL =====
const WS_URL =
  (import.meta.env.VITE_WS_URL || API.replace(/^http/i, "ws")) + "/ws/events";

// ===== helper: คนใน/คนนอก =====
function isInsideRole(role) {
  const r = String(role || "").trim();
  const rl = r.toLowerCase();
  if (["นักศึกษา", "อาจารย์", "เจ้าหน้าที่"].includes(r)) return true;
  if (["staff", "employee", "internal", "insider"].includes(rl)) return true;
  return false;
}

// ทิศทาง -> ภาษาไทย
const toThaiDirection = (v) => {
  const s = String(v || "").toUpperCase();
  if (s === "IN") return "เข้า";
  if (s === "OUT") return "ออก";
  if (s === "UNKNOWN") return "ไม่ทราบ";
  return s || "-";
};

// ==== helper ดึง URL รูปจากหลาย ๆ ชื่อ field ที่เป็นไปได้ ====
function extractImage(e = {}) {
  return (
    e.imgUrl ||
    e.image ||
    e.image_url ||
    e.imageUrl ||
    e.img ||
    e.photo ||
    e.file ||
    e.blob ||
    null
  );
}

/* ---------- helpers ---------- */
const buildQuery = (f) => {
  const p = new URLSearchParams();
  if (f.start) p.set("start_date", f.start);
  if (f.end) p.set("end_date", f.end);
  if (f.direction && f.direction !== "all") p.set("direction", f.direction);
  if (f.query) p.set("plate", f.query);
  p.set("limit", "5000");
  return p.toString();
};

const mapRows = (raw) =>
  Array.isArray(raw)
    ? raw.map((e) => {
        const check = isInsideRole(e.role) ? "บุคคลภายใน" : "บุคคลภายนอก";
        const img = extractImage(e);
        return {
          ...e,
          // เวลา
          time: formatThaiDateTime(e.time || e.datetime),
          // ทะเบียน + จังหวัด
          plate: `${e.plate || "-"}${e.province ? " จ." + e.province : ""}`,
          // สถานะเข้า/ออก
          status: toThaiDirection(e.direction),
          // คนใน/คนนอก
          check,
          // ให้มีทั้ง imgUrl และ image เผื่อ RecordsTable ใช้อันไหนอยู่
          imgUrl: img,
          image: img,
          _raw: e,
        };
      })
    : [];

/* ---------- page ---------- */
export default function Search() {
  const [filters, setFilters] = useState({
    start: "",
    end: "",
    direction: "all",
    query: "",
  });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const controllerRef = useRef(null);
  const wsRef = useRef(null);
  const stopRef = useRef(false);
  const retryRef = useRef(0);

  // ✅ แก้ตรงนี้ให้ใช้ AbortController อย่างถูกต้อง
  const load = async (f) => {
    // ยกเลิก request ก่อนหน้า (ถ้ามี)
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;

    setLoading(true);
    try {
      const res = await fetch(`${API}/events?${buildQuery(f)}`, { signal });
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

  // โหลดครั้งแรก
  useEffect(() => {
    load(filters);
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WebSocket: เพิ่ม record ใหม่เข้ามาบนสุด
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
          const data =
            typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
          if (!data?.datetime) return;

          const check = isInsideRole(data.role)
            ? "บุคคลภายใน"
            : "บุคคลภายนอก";

          const img = extractImage(data);

          const newRecord = {
            time: formatThaiDateTime(data.datetime),
            plate: `${data.plate || "-"}${
              data.province ? " จ." + data.province : ""
            }`,
            status: toThaiDirection(data.direction),
            check,
            imgUrl: img,
            image: img,
            _raw: data,
          };

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
  }, []);

  // กด “ใช้ฟิลเตอร์”
  const onApply = () => {
    load(filters);
  };

  const onReset = () => {
    const f = { start: "", end: "", direction: "all", query: "" };
    setFilters(f);
    load(f);
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

  return (
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
          <span className="text-sm text-slate-600">
            Items {records.length} items
          </span>
        </div>

        <RecordsTable records={records} />

        {loading && (
          <div className="py-6 text-center text-sm text-slate-600">
            กำลังโหลด...
          </div>
        )}
        {!loading && records.length === 0 && (
          <div className="py-6 text-center text-sm text-slate-600">
            ไม่พบข้อมูล
          </div>
        )}
      </section>
    </div>
  );
}
