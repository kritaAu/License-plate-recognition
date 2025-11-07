import { useEffect, useState } from "react";
import Filters from "../components/Filters";
import StatsCards from "../components/StatsCards";
import LineChart from "../components/LineChart";              
import DailyLineChart from "../components/DailyLineChart";    // กราฟรายวัน 2 เส้น
import RecordsTable from "../components/RecordsTable";
import { getRecentEvents } from "../services/dashboardApi";
import { formatThaiDateTime } from "../utils/date";

export default function Home() {
  const [filters, setFilters] = useState({
    start: "2025-08-01",
    end: "2025-08-09",
    direction: "all",
    query: "",
  });

  // การ์ดสถิติ + ตาราง (จะผูกกับ dailyDate)
  const [stats, setStats] = useState({ total: 0, in: 0, out: 0, unknown: 0 });
  const [records, setRecords] = useState([]);

  // กราฟรายเดือน (อย่าแตะ)
  const [lineData] = useState([]);

  // ===== กราฟรายวัน =====
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dailyDate, setDailyDate] = useState(todayStr); // วันสำหรับกราฟรายวัน + ตาราง
  const [dailySeries, setDailySeries] = useState([]);   // [{label, inside, outside}]
  const [rawEvents, setRawEvents] = useState([]);       // เก็บข้อมูลดิบจาก API

  useEffect(() => {
    loadRecent();
  }, []);

  // เมื่อเปลี่ยนวัน หรือได้ข้อมูลดิบใหม่: อัปเดต “กราฟรายวัน” + “ตาราง” + “การ์ดสถิติ”
  useEffect(() => {
    buildDailySeries(rawEvents, dailyDate);
    rebuildRecordsAndStatsForDay(rawEvents, dailyDate);
  }, [rawEvents, dailyDate]);

  const loadRecent = async () => {
    const res = await getRecentEvents();
    const list = Array.isArray(res) ? res : res?.data || [];
    setRawEvents(list); // เก็บดิบไว้ใช้สร้างกราฟ/ตาราง/การ์ดตามวัน
  };

  // ===== helper: กราฟรายวัน 24 ชั่วโมงของวันที่เลือก =====
  const buildDailySeries = (events, dateStr) => {
    if (!Array.isArray(events) || !dateStr) {
      setDailySeries([]);
      return;
    }
    const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
    const day = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0); // local

    const pad = (n) => String(n).padStart(2, "0");
    const keyOf = (dt) =>
      `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}`;

    // เตรียม bucket 0..23 ชม.
    const hours = Array.from({ length: 24 }, (_, h) =>
      new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0, 0, 0)
    );
    const buckets = new Map(
      hours.map((h) => [
        keyOf(h),
        { inside: 0, outside: 0, label: `${pad(h.getHours())}:00` },
      ])
    );

    for (const x of events) {
      const dt = new Date(x.datetime);
      if (isNaN(dt)) continue;

      const sameDay =
        dt.getFullYear() === day.getFullYear() &&
        dt.getMonth() === day.getMonth() &&
        dt.getDate() === day.getDate();
      if (!sameDay) continue;

      if ((x.direction || "").toLowerCase() !== "in") continue; // นับเฉพาะ “เข้า”

      const k = keyOf(dt);
      const b = buckets.get(k);
      if (!b) continue;

      const isInside = (x.role || "").toLowerCase() === "staff"; // staff = บุคคลภายใน
      if (isInside) b.inside += 1;
      else b.outside += 1;
    }

    setDailySeries(Array.from(buckets.values()));
  };

  // ===== helper: ตาราง + การ์ดสถิติ (ยึดวันเดียวกับ dailyDate) =====
  const rebuildRecordsAndStatsForDay = (events, dateStr) => {
    if (!Array.isArray(events) || !dateStr) {
      setRecords([]);
      setStats({ total: 0, in: 0, out: 0, unknown: 0 });
      return;
    }
    const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
    const day = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);

    // กรองเฉพาะเหตุการณ์ “วันนั้น”
    const filtered = events.filter((e) => {
      const dt = new Date(e.datetime);
      if (isNaN(dt)) return false;
      return (
        dt.getFullYear() === day.getFullYear() &&
        dt.getMonth() === day.getMonth() &&
        dt.getDate() === day.getDate()
      );
    });

    // สร้างตาราง
    const mapped = filtered.map((e) => {
      const dir = (e.direction || "").toLowerCase();
      const status = dir === "in" ? "เข้า" : dir === "out" ? "ออก" : e.direction || "-";
      const check = (e.role || "").toLowerCase() === "staff" ? "บุคคลภายใน" : "บุคคลภายนอก";
      return {
        time: formatThaiDateTime(e.datetime),
        plate: `${e.plate || "-"}${e.province ? " จ." + e.province : ""}`,
        status,
        check,
        imgUrl: e.image || null,
        _raw: e,
      };
    });
    setRecords(mapped);

    // คำนวณการ์ดสถิติจากชุดเดียวกับตาราง (filtered)
    const inCount = filtered.filter((x) => (x.direction || "").toLowerCase() === "in").length;
    const outCount = filtered.filter((x) => (x.direction || "").toLowerCase() === "out").length;
    const unknownCount = filtered.filter((x) => !x.plate || x.plate === "-").length;
    setStats({ total: filtered.length, in: inCount, out: outCount, unknown: unknownCount });
  };

  // ฟิลเตอร์เดิม (ไม่ได้ผูกกับ dailyDate)
  const handleApplyFilters = () => {
    loadRecent();
  };
  const handleResetFilters = () => {
    setFilters({
      start: "2025-08-01",
      end: "2025-08-09",
      direction: "all",
      query: "",
    });
    loadRecent();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* ฟิลเตอร์เดิม ซ่อนไว้ตามเดิม */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 hidden">
          <Filters
            filters={filters}
            setFilters={setFilters}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
          />
        </div>

        {/* การ์ดสถิติ: อิงข้อมูลของตาราง (filtered ตาม dailyDate) */}
        <StatsCards stats={stats} />

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* กราฟรายเดือน: ไม่แตะ */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">สถิติรายเดือน</h3>
            <LineChart data={lineData} />
          </div>

          {/* กราฟรายวัน + ตัวเลือกวันที่ (ผูกกับตารางและการ์ดสถิติ) */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-700">
                สถิติรายวัน (แยกภายใน/ภายนอก) — {dailyDate}
              </h3>
              <input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <DailyLineChart series={dailySeries} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">รายการล่าสุด (เฉพาะ {dailyDate})</h3>
            <span className="text-sm text-gray-500">Items {records.length} items</span>
          </div>
          <RecordsTable records={records} />
        </div>
      </div>
    </div>
  );
}
