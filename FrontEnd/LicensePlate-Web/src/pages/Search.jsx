// src/pages/Search.jsx
import {
  useEffect,
  useState,
  useRef,
  useDeferredValue,
  startTransition,
} from "react";
import Filters from "../components/Filters";
import RecordsTable from "../components/RecordsTable";
import ExportModal from "../components/ExportModal";
import { formatThaiDateTime } from "../utils/date";

const API = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
const WS_URL =
  (import.meta.env.VITE_WS_URL || API.replace(/^http/i, "ws")) + "/ws/events";

// จำกัดจำนวนรายการในหน้าเพื่อลดงานเรนเดอร์
const LIST_LIMIT = 300;

/* ===== Helpers ===== */
// ภายใน/ภายนอก (fallback เมื่อ backend ไม่ส่ง check มา)
function isInsideRole(role) {
  const r = String(role || "").trim();
  const rl = r.toLowerCase();
  if (["นักศึกษา", "อาจารย์", "เจ้าหน้าที่"].includes(r)) return true;
  if (["staff", "employee", "internal", "insider"].includes(rl)) return true;
  return false;
}

// ทิศทาง -> ภาษาไทย (fallback เมื่อ backend ไม่ส่ง status มา)
function toThaiDirection(v) {
  const s = String(v || "").toUpperCase();
  if (s === "IN") return "เข้า";
  if (s === "OUT") return "ออก";
  if (s === "UNKNOWN") return "ไม่ทราบ";
  return s || "-";
}

// ดึง URL รูป (ทนทานกับ schema เก่า/ใหม่)
function extractImage(e = {}) {
  return e.blob ?? null;
}

// คำนวณ limit ตามช่วงวัน (ยืดหยุ่นขึ้น แต่ไม่เกิน LIST_LIMIT)
function computeLimit(f) {
  if (f?.start && f?.end) {
    const ms = new Date(f.end) - new Date(f.start);
    const days = Math.max(1, Math.round(ms / 86400000) + 1);
    return Math.min(LIST_LIMIT, days * 120); // ประมาณ 120 รายการ/วัน
  }
  return Math.min(LIST_LIMIT, 300);
}

// query ให้ตรงกับ backend (ใช้ query สำหรับป้ายทะเบียน)
const buildQuery = (f) => {
  const p = new URLSearchParams();
  if (f.start) p.set("start_date", f.start);
  if (f.end) p.set("end_date", f.end);
  if (f.direction && f.direction !== "all") p.set("direction", f.direction);
  if (f.query) p.set("query", f.query);
  p.set("limit", String(computeLimit(f)));
  return p.toString();
};

// map ข้อมูลให้เข้ากับตาราง (ไม่ต่อจังหวัดใน plate)
const mapRows = (raw) =>
  Array.isArray(raw)
    ? raw.map((e) => {
        const img = extractImage(e);
        return {
          ...e,
          time: formatThaiDateTime(e.time || e.datetime),
          plate: e.plate || "-",
          province: e.province || "-",
          status: e.status || toThaiDirection(e.direction),
          check:
            e.check || (isInsideRole(e.role) ? "บุคคลภายใน" : "บุคคลภายนอก"),
          imgUrl: img,
          image: img,
          _raw: e,
        };
      })
    : [];

// ตรวจว่าเรคคอร์ดจาก WS ตรงกับฟิลเตอร์ปัจจุบันไหม (กันเด้งรายการที่ไม่เกี่ยว)
function recordPassesFilters(d, f) {
  const dtVal = d.time || d.datetime;
  const dt = dtVal ? new Date(dtVal) : null;

  if (f.start && dt) {
    const from = new Date(`${f.start}T00:00:00`);
    if (dt < from) return false;
  }
  if (f.end && dt) {
    const to = new Date(`${f.end}T23:59:59`);
    if (dt > to) return false;
  }

  if (f.direction && f.direction !== "all") {
    const de = String(d.direction || d.status || "").toUpperCase();
    const norm = de === "เข้า" ? "IN" : de === "ออก" ? "OUT" : de;
    if (norm !== f.direction.toUpperCase()) return false;
  }

  if (f.query) {
    const q = f.query.toLowerCase();
    if (
      !String(d.plate || "")
        .toLowerCase()
        .includes(q)
    )
      return false;
  }

  return true;
}

/* ===== Page ===== */
export default function Search() {
  const [filters, setFilters] = useState({
    start: "",
    end: "",
    direction: "all",
    query: "",
  });
  const [records, setRecords] = useState([]);
  const deferredRecords = useDeferredValue(records);
  const [loading, setLoading] = useState(true);

  // state เปิด/ปิด Export Modal
  const [exportOpen, setExportOpen] = useState(false);

  const controllerRef = useRef(null);
  const wsRef = useRef(null);
  const stopRef = useRef(false);
  const retryRef = useRef(0);
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // โหลดข้อมูลโดยยกเลิก request เก่าเสมอ (ลด overfetch)
  const load = async (f) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;

    setLoading(true);
    try {
      const res = await fetch(`${API}/events?${buildQuery(f)}`, {
        signal,
        cache: "no-store",
      });
      if (!res.ok)
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      const raw = await res.json();
      const mapped = mapRows(raw).slice(0, LIST_LIMIT);
      startTransition(() => setRecords(mapped));
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error(err);
        startTransition(() => setRecords([]));
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

  // WebSocket: รับเหตุการณ์ใหม่ (ที่ผ่านฟิลเตอร์) แทรกบนสุด และจำกัดจำนวน
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
          if (!data) return;
          if (!recordPassesFilters(data, filtersRef.current)) return;

          const dt = data.time || data.datetime;
          if (!dt) return;

          const img = extractImage(data);
          const newRecord = {
            time: formatThaiDateTime(dt),
            plate: data.plate || "-",
            province: data.province || "-",
            status: data.status || toThaiDirection(data.direction),
            check:
              data.check ||
              (isInsideRole(data.role) ? "บุคคลภายใน" : "บุคคลภายนอก"),
            imgUrl: img,
            image: img,
            _raw: data,
          };

          startTransition(() => {
            const keyOf = (r) =>
              `${r.time}|${r.plate}|${r.province}|${r.status}`;
            setRecords((prev) => {
              if (prev[0] && keyOf(prev[0]) === keyOf(newRecord)) return prev; // กันซ้ำหัวรายการ
              const next = [newRecord, ...prev];
              if (next.length > LIST_LIMIT) next.length = LIST_LIMIT;
              return next;
            });
          });
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

  // ใช้ฟิลเตอร์
  const onApply = () => {
    load(filters);
  };

  // ล้างฟิลเตอร์
  const onReset = () => {
    const f = { start: "", end: "", direction: "all", query: "" };
    setFilters(f);
    load(f);
  };

  // เปิด Export Modal
  const onExport = () => {
    setExportOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 bg-gradient-to-tr from-white to-blue-400">
      <div className="rounded-xl bg-slate-200/60 p-6">
        <Filters
          filters={filters}
          setFilters={setFilters}
          onApply={onApply}
          onReset={onReset}
          onExport={onExport} // ✅ เรียกเปิด CSV modal
        />
      </div>

      <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-6 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">รายการล่าสุด</h3>
          <span className="text-sm text-slate-600">
            Items {deferredRecords.length} items
          </span>
        </div>

        <RecordsTable records={deferredRecords} />

        {loading && (
          <div className="py-6 text-center text-sm text-slate-600">
            กำลังโหลด...
          </div>
        )}
        {!loading && deferredRecords.length === 0 && (
          <div className="py-6 text-center text-sm text-slate-600">
            ไม่พบข้อมูล
          </div>
        )}
      </section>

      {/* Export Modal */}
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        defaultFilters={{
          start: filters.start,
          end: filters.end,
          direction: filters.direction,
          query: filters.query,
        }}
      />
    </div>
  );
}
