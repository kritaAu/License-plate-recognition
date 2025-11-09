// src/pages/Search.jsx (ฉบับแก้ไขที่สมบูรณ์)
import { useEffect, useState, useCallback } from "react";
import Filters from "../components/Filters"; 
import RecordsTable from "../components/RecordsTable";
import { formatThaiDateTime } from "../utils/date";
import { downloadCsv } from "../utils/downloadCsv";

const API = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// 🌟 Helper function ใหม่สำหรับเรียก API /events
const fetchFilteredEvents = async (currentFilters) => {
  // 1. สร้าง Query Parameters
  const params = new URLSearchParams({
    start_date: currentFilters.start || "",
    end_date: currentFilters.end || "",
    direction: currentFilters.direction || "all",
    query: currentFilters.query || "",
    limit: 5000, 
  });

  try {
    const response = await fetch(`${API}/events?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    const eventsList = await response.json(); // API คืนค่า Array ที่ Map แล้ว

    // 2. Map ข้อมูลที่ได้จาก API (เฉพาะเวลา)
    const mappedRecords = eventsList.map(e => ({
        ...e, // ใช้ข้อมูลที่ Map แล้วจาก API (plate, province, status, check, imgUrl)
        time: formatThaiDateTime(e.time), // แปลงเวลาเป็น String
    }));
    return mappedRecords;

  } catch (error) {
    console.error("Failed to fetch events:", error);
    return []; 
  }
};

export default function Search() {
  const [filters, setFilters] = useState({
    // 🌟🌟🌟 แก้ไขจุดนี้ 🌟🌟🌟
    start: "", // เริ่มต้นเป็นค่าว่าง
    end: "",   // เริ่มต้นเป็นค่าว่าง
    // 🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟🌟
    direction: "all",
    query: "",
  });

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true); 

  // 🌟 โหลดข้อมูลครั้งแรก (จะใช้ filter ที่เป็นค่าว่าง)
  useEffect(() => {
    (async () => {
      setLoading(true);
      const mappedRecords = await fetchFilteredEvents(filters); 
      setRecords(mappedRecords);
      setLoading(false);
    })();
  }, []); // 🌟 ให้ทำงานแค่ครั้งเดียวตอนเปิดหน้า

  // 🌟 กด “ใช้ฟิลเตอร์” -> เรียก API ใหม่ (เหมือนเดิม)
  const onApply = async () => {
    setLoading(true);
    const mappedRecords = await fetchFilteredEvents(filters);
    setRecords(mappedRecords);
    setLoading(false);
  };

  // 🌟 กด “ล้างฟิลเตอร์” -> เรียก API ใหม่ (เหมือนเดิม)
  const onReset = async () => {
    setLoading(true);
    const f = { start: "", end: "", direction: "all", query: "" };
    setFilters(f);
    const mappedRecords = await fetchFilteredEvents(f); 
    setRecords(mappedRecords);
    setLoading(false);
  };

  // 🌟 กด “Export CSV” (เหมือนเดิม)
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
      {/* 🌟 ใช้ Component Filters.jsx (ที่คุณอัปโหลด) */}
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
