// src/pages/Search.jsx
import { useEffect, useState } from "react";
import Filters from "../components/Filters";
import RecordsTable from "../components/RecordsTable";
import { getRecentEvents } from "../services/dashboardApi";
import { formatThaiDateTime } from "../utils/date";
import { downloadCsv } from "../utils/downloadCsv";

const API = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export default function Search() {
  const [filters, setFilters] = useState({
    start: "2025-08-01",
    end: "2025-08-09",
    direction: "all",
    query: "",
  });

  const [rawEvents, setRawEvents] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  // โหลดข้อมูลครั้งแรก
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await getRecentEvents();
        const list = Array.isArray(res) ? res : res?.data || [];
        setRawEvents(list);
        setRecords(buildRecords(list, filters)); // ให้มีข้อมูลโชว์ทันทีตามฟิลเตอร์เริ่มต้น
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // กด “ใช้ฟิลเตอร์”
  const onApply = () => {
    setRecords(buildRecords(rawEvents, filters));
  };

  // กด “ล้างฟิลเตอร์”
  const onReset = () => {
    const f = { start: "", end: "", direction: "all", query: "" };
    setFilters(f);
    setRecords(buildRecords(rawEvents, f));
  };

  // กด “Export CSV”
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
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="bg-slate-200/60 rounded-xl p-6">
        <Filters
          filters={filters}
          setFilters={setFilters}
          onApply={onApply}
          onReset={onReset}
          onExport={onExport}
        />

        {/* ช่วงวันที่ที่เลือก */}
        <p className="mt-3 text-sm text-slate-700">
          ช่วงวันที่ที่เลือก: {displayRange(filters.start, filters.end)}
        </p>
      </div>

      {/* ตารางผลลัพธ์ */}
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
      </section>
    </div>
  );
}

/* ---------- helpers ---------- */

function inRange(ts, start, end) {
  const t = new Date(ts).getTime();
  const s = start ? new Date(`${start}T00:00:00`).getTime() : -Infinity;
  const e = end ? new Date(`${end}T23:59:59`).getTime() : Infinity;
  return t >= s && t <= e;
}

function buildRecords(events, f) {
  const dir = (f.direction || "all").toLowerCase();
  const q = (f.query || "").toLowerCase();

  return (events || [])
    .filter((e) => inRange(e.datetime, f.start, f.end))
    .filter((e) =>
      dir === "all" ? true : (e.direction || "").toLowerCase() === dir
    )
    .filter((e) =>
      q ? (e.plate || "").toLowerCase().includes(q) : true
    )
    .map((e) => ({
      time: formatThaiDateTime(e.datetime),
      plate: `${e.plate || "-"}${e.province ? " จ." + e.province : ""}`,
      status:
        (e.direction || "").toLowerCase() === "in"
          ? "เข้า"
          : (e.direction || "").toLowerCase() === "out"
          ? "ออก"
          : "-",
      check:
        (e.role || "").toLowerCase() === "staff"
          ? "บุคคลภายใน"
          : "บุคคลภายนอก",
      imgUrl: e.image || null,
      _raw: e,
    }));
}

function displayRange(s, e) {
  if (!s && !e) return "ทั้งหมด";
  const fmt = (x) =>
    x ? new Date(x).toLocaleDateString("th-TH") : "-";
  return `${fmt(s)} – ${fmt(e)}`;
}
