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
import {
  formatThaiDateTime,
  addDays,
  toLocalDateKey,
} from "../utils/date";
import { fetchEvents, EVENTS_WS_URL } from "../services/api";

// จำกัดจำนวนรายการในหน้าเพื่อลดงานเรนเดอร์
const LIST_LIMIT = 300;
const BKK_TZ = "Asia/Bangkok";

/* ================= Helpers ================= */

// ใช้ดูว่า role เป็นคนในหรือคนนอก
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
  return (
    e.imgUrl ||
    e.image ||
    e.blob ||
    e.image_url ||
    e.image_path ||
    null
  );
}

// คำนวณ limit ตามช่วงวัน (อิงจาก start/end ที่ผู้ใช้เลือก)
function computeLimit(f) {
  const hasRange = f.start && f.end;
  if (!hasRange) return LIST_LIMIT;
  try {
    const start = new Date(f.start);
    const end = new Date(f.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return LIST_LIMIT;
    }
    const diffDays =
      Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
      1;
    // สมมติให้ 1 วันดึงได้ ~100 แถว แต่ไม่เกิน LIST_LIMIT
    return Math.min(LIST_LIMIT, Math.max(1, diffDays) * 100);
  } catch {
    return LIST_LIMIT;
  }
}

// map raw events จาก backend -> records ที่ใช้กับ RecordsTable
function mapEventsToRows(raw) {
  if (!Array.isArray(raw)) return [];

  return raw.map((e) => {
    const img = extractImage(e);

    // ใส่ event_id / session_id ให้แน่ใจว่ามี
    const eventId = e.event_id ?? e.id ?? null;
    const sessionId = e.session_id ?? null;
    const rawWithIds = { ...e, event_id: eventId, session_id: sessionId };

    const isoTime =
      e.datetime ||
      e.time ||
      e.entry_time ||
      e.exit_time ||
      e.created_at ||
      null;

    const plate =
      e.plate ||
      e.plate_entry ||
      e.plate_exit ||
      e.license_plate ||
      e.plate_number ||
      e.plate_number_entry ||
      e.plate_number_exit ||
      "-";

    const province =
      e.province ||
      e.province_entry ||
      e.province_exit ||
      e.plate_province ||
      "";

    let status =
      e.status ||
      e.parking_status ||
      (e.direction ? toThaiDirection(e.direction) : "");

    const role = e.role || e.member_role || e.person_role || "";
    const check =
      e.check ||
      (role ? (isInsideRole(role) ? "บุคคลภายใน" : "บุคคลภายนอก") : "");

    return {
      ...rawWithIds,
      isoTime,
      time: isoTime ? formatThaiDateTime(isoTime) : "",
      plate,
      province,
      status,
      check,
      imgUrl: img,
      image: img,
      _raw: rawWithIds,
    };
  });
}

// ดึงวันที่ (แบบไทย / Asia-Bangkok) ทั้งหมดที่เกี่ยวข้องกับ record หนึ่งตัว
function getRecordLocalDates(rec) {
  const raw = rec._raw || {};
  const candidates = [
    rec.isoTime,
    rec.time_iso,
    rec.entry_time,
    rec.exit_time,
    rec.datetime,
    raw.datetime,
    raw.time,
    raw.entry_time,
    raw.exit_time,
    raw.created_at,
  ];

  const result = new Set();
  for (const val of candidates) {
    if (!val) continue;
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) continue;
    const dateStr = d.toLocaleDateString("en-CA", { timeZone: BKK_TZ }); // YYYY-MM-DD
    result.add(dateStr);
  }
  return Array.from(result);
}

// กรองตามช่วงวันที่ (ตีความเป็นเวลาไทย) จาก filters.start / filters.end
function recordMatchesDateFilter(rec, filters) {
  const start = filters?.start;
  const end = filters?.end;
  if (!start && !end) return true;

  const dates = getRecordLocalDates(rec);
  if (!dates.length) return true; // ถ้าไม่มีวันที่เลยก็ปล่อยผ่าน

  return dates.some((d) => {
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}

/* ================= Page ================= */

export default function Search() {
  const [filters, setFilters] = useState({
    start: "",
    end: "",
    // ตอนนี้ field นี้คือ "สถานะรถ" (ทั้งหมด / กำลังจอด / ออกแล้ว / ไม่พบข้อมูลขาเข้า)
    direction: "all",
    // ฟิลเตอร์ประเภทบุคคล (ทั้งหมด / inside / outside)
    personType: "all",
    query: "",
  });
  const [records, setRecords] = useState([]);
  const deferredRecords = useDeferredValue(records);
  const [loading, setLoading] = useState(true);

  const [exportOpen, setExportOpen] = useState(false);

  const controllerRef = useRef(null);
  const wsRef = useRef(null);
  const stopRef = useRef(false);
  const retryRef = useRef(0);
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const load = async (f) => {
  controllerRef.current?.abort();
  const controller = new AbortController();
  controllerRef.current = controller;
  const { signal } = controller;

  setLoading(true);
  try {
    // ===== ปรับวันที่ที่จะส่งไป backend =====
    let backendStart = f.start || undefined;
    if (f.start) {
      // ถ้ามีวันที่เริ่ม → ลดไป 1 วัน เพื่อกันกรณี timezone (UTC+7)
      const d = addDays(f.start, -1);
      backendStart = toLocalDateKey(d);
    }

    const params = {
      start: backendStart,
      end: f.end || undefined,
      query: f.query || undefined,
      limit: computeLimit(f),
    };

    // ไม่ส่งค่า direction ที่เป็นสถานะรถไป backend (ใช้เฉพาะ IN/OUT เท่านั้นถ้ามี)
    if (f.direction === "IN" || f.direction === "OUT") {
      params.direction = f.direction;
    }

    const raw = await fetchEvents(params, { signal });
    let mapped = mapEventsToRows(raw);

    // ===== กรองวันที่แบบเวลาไทย (ฝั่ง Front) =====
    if (f.start || f.end) {
      mapped = mapped.filter((rec) => recordMatchesDateFilter(rec, f));
    }

    // ===== กรองป้ายทะเบียน (กันกรณี backend ไม่รองรับ query) =====
    if (f.query) {
      const q = f.query.toLowerCase();
      mapped = mapped.filter((rec) =>
        String(rec.plate || rec._raw?.plate || "")
          .toLowerCase()
          .includes(q)
      );
    }

    mapped = mapped.slice(0, LIST_LIMIT);

    startTransition(() => setRecords(mapped));
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error(err);
    startTransition(() => setRecords([]));
  } finally {
    setLoading(false);
  }
};


  // initial load
  useEffect(() => {
    load(filters);
    return () => {
      controllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WebSocket live update
  useEffect(() => {
    if (!EVENTS_WS_URL) return;

    stopRef.current = false;
    let retry = retryRef.current;

    const connect = () => {
      const ws = new WebSocket(EVENTS_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
      };

      ws.onmessage = (ev) => {
        try {
          const data =
            typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
          if (!data) return;

          // map 1 แถวจาก message
          const mappedArr = mapEventsToRows([data]);
          const newRecord = mappedArr[0];
          if (!newRecord) return;

          const currentFilters = filtersRef.current;

          // กรองช่วงวันที่ด้วยเวลาไทย
          if (!recordMatchesDateFilter(newRecord, currentFilters)) return;

          // กรอง query
          if (currentFilters.query) {
            const q = currentFilters.query.toLowerCase();
            const plateText = String(
              newRecord.plate || newRecord._raw?.plate || ""
            ).toLowerCase();
            if (!plateText.includes(q)) return;
          }

          startTransition(() => {
            setRecords((prev) => {
              const keyOf = (r) =>
                `${r._raw?.event_id ?? r._raw?.id ?? ""}|${r.plate}|${
                  r.province
                }|${r.time}`;
              const newKey = keyOf(newRecord);

              if (prev[0] && keyOf(prev[0]) === newKey) return prev;

              const next = [newRecord, ...prev];
              if (next.length > LIST_LIMIT) next.length = LIST_LIMIT;
              return next;
            });
          });
        } catch (err) {
          console.error("WS message error:", err);
        }
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (stopRef.current) return;
        const delay = Math.min(16000, 1000 * 2 ** Math.min(4, retry++));
        retryRef.current = retry;
        setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      stopRef.current = true;
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
    };
  }, []);

  const onApply = () => {
    load(filters);
  };

  const onReset = () => {
    const next = {
      start: "",
      end: "",
      direction: "all",
      personType: "all",
      query: "",
    };
    setFilters(next);
    load(next);
  };

  const onExport = () => {
    setExportOpen(true);
  };

  // direction สำหรับ Export CSV ยังใช้ IN/OUT/all ตาม backend
  const exportDirection =
    filters.direction === "IN" || filters.direction === "OUT"
      ? filters.direction
      : "all";

  return (
    <div className="max-w-7xl mx-auto px-4 pb-6 pt-4">
      {/* กล่องฟิลเตอร์ด้านบน */}
      <div className="mb-4 rounded-2xl bg-blue-300 p-4 shadow-sm backdrop-blur">
        <Filters
          filters={filters}
          setFilters={setFilters}
          onApply={onApply}
          onReset={onReset}
          onExport={onExport}
        />
      </div>

      {/* ตารางรายการ */}
      <section className="rounded-2xl bg-white/80 p-4 shadow-sm backdrop-blur">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              รายการล่าสุด
            </h2>
            <p className="text-xs text-slate-500">
              แสดง session รถจักรยานยนต์ล่าสุดจากกล้อง
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>ทั้งหมด {deferredRecords.length} แถว</div>
            {loading && (
              <div className="text-[11px] text-amber-600">กำลังโหลด...</div>
            )}
          </div>
        </div>

        <RecordsTable records={deferredRecords} filters={filters} />

        {!loading && deferredRecords.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            ไม่พบข้อมูลตามเงื่อนไขที่เลือก
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
          direction: exportDirection,
          query: filters.query,
        }}
      />
    </div>
  );
}
