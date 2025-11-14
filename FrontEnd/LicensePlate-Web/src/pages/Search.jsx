// src/pages/Search.jsx (ฉบับแก้ไขที่สมบูรณ์)
import { useEffect, useState } from "react";
import Filters from "../components/Filters";
import RecordsTable from "../components/RecordsTable";
import { formatThaiDateTime } from "../utils/date";
import { downloadCsv } from "../utils/downloadCsv";

const API_BASE = (
  import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// แปลงทิศทางเป็นภาษาไทย
const toThaiDirection = (v) => {
  const s = String(v || "").toUpperCase();
  if (s === "IN") return "เข้า";
  if (s === "OUT") return "ออก";
  if (s === "UNKNOWN") return "ไม่ทราบ";
  return s || "-";
};

// ดึงเหตุการณ์ตามฟิลเตอร์
const fetchFilteredEvents = async (currentFilters) => {
  const params = new URLSearchParams({
    start_date: currentFilters.start || "",
    end_date: currentFilters.end || "",
    direction: currentFilters.direction || "all",
    query: currentFilters.query || "",
    limit: 5000,
  });

  try {
    const res = await fetch(`${API_BASE}/events?${params.toString()}`);
    if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);

    // backend ส่ง array ที่แมปแล้ว: { time, plate, province, status, check, imgUrl }
    const list = await res.json();

    // แปลงเวลา + ทิศทางเป็นไทย (คงค่าเดิมไว้ใน statusCode เผื่อคอมโพเนนต์อื่นใช้งาน)
    return list.map((e) => {
      const statusCode = e.status; // EN: IN/OUT/UNKNOWN (จาก backend)
      return {
        ...e,
        time: formatThaiDateTime(e.time),
        statusCode,
        status: toThaiDirection(statusCode), // ใช้ค่านี้แสดงผลในตาราง
      };
    });
  } catch (err) {
    console.error("Failed to fetch events:", err);
    return [];
  }
};

export default function Search() {
  const [filters, setFilters] = useState({
    start: "", // เริ่มต้นค่าว่าง
    end: "", // เริ่มต้นค่าว่าง
    direction: "all",
    query: "",
  });

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // โหลดครั้งแรก
  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await fetchFilteredEvents(filters);
      setRecords(data);
      setLoading(false);
    })();
  }, []); // ทำงานครั้งเดียว

  // กด “ใช้ฟิลเตอร์”
  const onApply = async () => {
    setLoading(true);
    const data = await fetchFilteredEvents(filters);
    setRecords(data);
    setLoading(false);
  };

  // กด “ล้างฟิลเตอร์”
  const onReset = async () => {
    setLoading(true);
    const f = { start: "", end: "", direction: "all", query: "" };
    setFilters(f);
    const data = await fetchFilteredEvents(f);
    setRecords(data);
    setLoading(false);
  };

  // Export CSV
  const onExport = async () => {
    const params = new URLSearchParams({
      start: filters.start || "",
      end: filters.end || "",
      direction: filters.direction !== "all" ? filters.direction : "",
      plate: filters.query || "",
    });
    await downloadCsv(`${API_BASE}/export/events?${params.toString()}`);
  };

  const ws = new WebSocket("ws://127.0.0.1:8000/ws/events");

  ws.onmessage = (ev) => {
    const data = JSON.parse(ev.data);
    // อัปเดต UI แบบ real-time
    setRawEvents((prev) => [data, ...prev]);
  };

  return (
    <div class="pt-0 bg-gradient-to-br from-white to-blue-400">
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
        </div>

        {/* ตารางผลลัพธ์ */}
        <section className="mt-6 bg-white rounded-2xl border border-slate-100 shadow p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">รายการล่าสุด</h3>
            <span className="text-sm text-slate-600">
              Items {records.length} items
            </span>
          </div>

          <RecordsTable records={records} pageSize={10} />

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
    </div>
  );
}
