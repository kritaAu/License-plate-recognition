// src/pages/Home.jsx
import { useEffect, useRef, useState } from "react";
import Filters from "../components/Filters";
import StatsCards from "../components/StatsCards";
import DailyLineChart from "../components/DailyLineChart";
import RecordsTable from "../components/RecordsTable";
import WeeklyBarChart from "../components/WeeklyBarChart";
import { getRecentEvents } from "../services/dashboardApi";
import { formatThaiDateTime } from "../utils/date";

// ===== สร้าง WS_URL จาก env หรือ fallback =====
const API = (
  import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
const WS_URL =
  (import.meta.env?.VITE_WS_URL || API.replace(/^http/i, "ws")) + "/ws/events";

// ===== helper: คนใน/คนนอก =====
function isInsideRole(role) {
  const r = String(role || "").trim();
  const rl = r.toLowerCase();
  if (["นักศึกษา", "อาจารย์", "เจ้าหน้าที่"].includes(r)) return true;
  if (["staff", "employee", "internal", "insider"].includes(rl)) return true;
  return false;
}

// สำหรับสร้าง yyyy-mm-dd แบบ Local
const pad2 = (n) => String(n).padStart(2, "0");
function todayLocalStr() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate()
  )}`;
}

export default function Home() {
  const [filters, setFilters] = useState({
    start: "2025-08-01",
    end: "2025-08-09",
    direction: "all",
    query: "",
  });

  const [stats, setStats] = useState({ total: 0, in: 0, out: 0, unknown: 0 });

  // แยกคนใน/คนนอก
  const [personType, setPersonType] = useState("all"); // all | inside | outside
  const [countsByRole, setCountsByRole] = useState({ inside: 0, outside: 0 });

  // ตาราง
  const [records, setRecords] = useState([]);
  const [recordsRawForDay, setRecordsRawForDay] = useState([]);

  // รายวัน
  const [dailyDate, setDailyDate] = useState(todayLocalStr());
  const [dailySeries, setDailySeries] = useState([]);
  const [rawEvents, setRawEvents] = useState([]);

  // รายสัปดาห์ (รถเข้า)
  const [weeklyInData, setWeeklyInData] = useState([]);

  // ==== LIVE (WebSocket) ====
  const [live, setLive] = useState(true);
  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const stopRef = useRef(false);

  useEffect(() => {
    loadRecent();
  }, []);

  useEffect(() => {
    buildDailySeries(rawEvents, dailyDate);
    rebuildRecordsAndStatsForDay(rawEvents, dailyDate);
    setWeeklyInData(buildWeeklyInData(rawEvents));
  }, [rawEvents, dailyDate]);

  // กรองตารางตาม personType
  useEffect(() => {
    const filtered =
      personType === "inside"
        ? recordsRawForDay.filter((r) => r.check === "บุคคลภายใน")
        : personType === "outside"
        ? recordsRawForDay.filter((r) => r.check === "บุคคลภายนอก")
        : recordsRawForDay;

    setRecords(filtered);
  }, [personType, recordsRawForDay]);

  // ---- WebSocket effect ----
  useEffect(() => {
    if (!live) {
      stopRef.current = true;
      if (wsRef.current) wsRef.current.close();
      return;
    }

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
          // data จาก WS จะมี member_name / member_department ด้วย (ถ้าเป็นบุคคลภายใน)
          setRawEvents((prev) => [data, ...prev]);
        } catch {
          // ไม่ใช่ JSON -> ข้าม
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
  }, [live]);

  const loadRecent = async () => {
    const res = await getRecentEvents();
    const list = Array.isArray(res) ? res : res?.data || [];
    // list แต่ละตัวควรมี member_name / member_department มาจาก /dashboard/recent แล้ว
    setRawEvents(list);
  };

  // ===== Helper: รายสัปดาห์ =====
  const startOfWeek = (date) => {
    const d = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,
      0,
      0,
      0
    );
    const day = (d.getDay() + 6) % 7; // จันทร์=0
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const addDays = (d, days) => {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
  };
  const buildWeekRanges = () => {
    const today = new Date();
    const thisMon = startOfWeek(today);
    return [
      {
        label: "3 สัปดาห์ก่อน",
        start: addDays(thisMon, -21),
        end: addDays(thisMon, -14),
      },
      {
        label: "2 สัปดาห์ก่อน",
        start: addDays(thisMon, -14),
        end: addDays(thisMon, -7),
      },
      {
        label: "สัปดาห์ก่อน",
        start: addDays(thisMon, -7),
        end: addDays(thisMon, 0),
      },
      {
        label: "สัปดาห์นี้",
        start: addDays(thisMon, 0),
        end: addDays(thisMon, 7),
      },
    ];
  };
  const buildWeeklyInData = (events) => {
    if (!Array.isArray(events)) return [];
    const weeks = buildWeekRanges();
    const isIn = (x) => (x?.direction || "").toLowerCase() === "in";
    const out = weeks.map((w) => ({ label: w.label, count: 0 }));
    for (const e of events) {
      if (!isIn(e)) continue;
      const dt = new Date(e.datetime);
      if (Number.isNaN(+dt)) continue;
      for (let i = 0; i < weeks.length; i++) {
        const { start, end } = weeks[i];
        if (dt >= start && dt < end) {
          out[i].count += 1;
          break;
        }
      }
    }
    return out;
  };

  // ===== Helper: รายวัน =====
  const buildDailySeries = (events, dateStr) => {
    if (!Array.isArray(events) || !dateStr) {
      setDailySeries([]);
      return;
    }

    const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
    const start = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
    const end = new Date(y, (m || 1) - 1, (d || 1) + 1, 0, 0, 0, 0);

    const pad = (n) => String(n).padStart(2, "0");

    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      label: `${pad(hour)}:00`,
      internal: 0,
      external: 0,
      inside: 0,
      outside: 0,
    }));

    for (const ev of events) {
      const dt = new Date(ev.datetime);
      if (Number.isNaN(+dt)) continue;
      if (!(dt >= start && dt < end)) continue;

      const h = dt.getHours();
      const isInternal = isInsideRole(ev.role);

      if (isInternal) {
        buckets[h].internal += 1;
        buckets[h].inside += 1;
      } else {
        buckets[h].external += 1;
        buckets[h].outside += 1;
      }
    }

    setDailySeries(buckets);
  };

  // ===== Helper: ตาราง + การ์ดสถิติของวัน =====
  const rebuildRecordsAndStatsForDay = (events, dateStr) => {
    if (!Array.isArray(events) || !dateStr) {
      setRecords([]);
      setRecordsRawForDay([]);
      setStats({ total: 0, in: 0, out: 0, unknown: 0 });
      setCountsByRole({ inside: 0, outside: 0 });
      return;
    }
    const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
    const day = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);

    const filtered = events.filter((e) => {
      const dt = new Date(e.datetime);
      if (isNaN(dt)) return false;
      return (
        dt.getFullYear() === day.getFullYear() &&
        dt.getMonth() === day.getMonth() &&
        dt.getDate() === day.getDate()
      );
    });

    const mapped = filtered.map((e) => {
      const dir = (e.direction || "").toLowerCase();
      const status =
        dir === "in" ? "เข้า" : dir === "out" ? "ออก" : e.direction || "-";
      const check = isInsideRole(e.role) ? "บุคคลภายใน" : "บุคคลภายนอก";

      const formattedTime = formatThaiDateTime(e.datetime);

      // 🔎 ดึงชื่อ + แผนกจาก event (รองรับทั้งจาก /dashboard/recent และ WS)
      const memberName =
        e.member_name ||
        e.driver_name ||
        e.owner_name ||
        e.full_name ||
        e.name ||
        null;

      const memberDept =
        e.member_department ||
        e.department ||
        e.dept ||
        null;

      return {
        time: formattedTime,
        plate: `${e.plate || "-"}${e.province ? " จ." + e.province : ""}`,
        status,
        check,
        imgUrl: e.image || e.blob || null,
        // เก็บชื่อ/แผนกไว้บน record ด้วย เผื่อ component อื่นใช้
        member_name: memberName,
        member_department: memberDept,
        // และย้ำเก็บลง _raw เพื่อให้ RecordsTable modal อ่านได้แน่นอน
        _raw: {
          ...e,
          member_name: memberName,
          member_department: memberDept,
        },
      };
    });

    setRecordsRawForDay(mapped);

    const inCount = filtered.filter(
      (x) => (x.direction || "").toLowerCase() === "in"
    ).length;
    const outCount = filtered.filter(
      (x) => (x.direction || "").toLowerCase() === "out"
    ).length;
    const unknownCount = filtered.filter(
      (x) => !x.plate || x.plate === "-"
    ).length;
    setStats({
      total: filtered.length,
      in: inCount,
      out: outCount,
      unknown: unknownCount,
    });

    const insideCount = filtered.filter((x) => isInsideRole(x.role)).length;
    const outsideCount = filtered.length - insideCount;
    setCountsByRole({ inside: insideCount, outside: outsideCount });
  };

  const handleApplyFilters = () => loadRecent();
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
    <div className="min-h-screen bg-gradient-to-br from-white to-blue-400">
      <div className="mx-auto max-w-5xl px-3" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ฟิลเตอร์ (ซ่อนไว้ตามเดิม) */}
        <div className="hidden bg-white/70 backdrop-blur border border-sky-100 shadow-sm rounded-2xl p-6 mb-6">
          <Filters
            filters={filters}
            setFilters={setFilters}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
          />
        </div>

        {/* แถบ Live toggle */}
        <div className="mb-4 flex items-center justify-end">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={live}
              onChange={(e) => setLive(e.target.checked)}
              className="h-4 w-4 rounded accent-sky-600"
            />
            อัปเดตแบบ Live (WebSocket)
          </label>
        </div>

        {/* การ์ดสถิติ */}
        <div className="mb-3">
          <StatsCards stats={stats} />
        </div>

        {/* สรุปภายใน/ภายนอก + ปุ่มกรองตาราง */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
              ภายใน: {countsByRole.inside}
            </span>
            <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
              ภายนอก: {countsByRole.outside}
            </span>
          </div>

          {/* ปุ่มกรองตาม personType */}
          <div className="inline-flex rounded-xl border border-sky-200 bg-white px-1 text-sm">
            <button
              type="button"
              onClick={() => setPersonType("all")}
              className={`px-3 py-1 !rounded-full ${
                personType === "all"
                  ? "bg-sky-600 text-white"
                  : "text-slate-700 hover:bg-sky-50"
              }`}
            >
              ทั้งหมด
            </button>

            <button
              type="button"
              onClick={() => setPersonType("inside")}
              className={`px-3 py-1 !rounded-full ${
                personType === "inside"
                  ? "bg-sky-600 text-white"
                  : "text-slate-700 hover:bg-sky-50"
              }`}
            >
              ภายใน
            </button>

            <button
              type="button"
              onClick={() => setPersonType("outside")}
              className={`px-3 py-1 !rounded-full ${
                personType === "outside"
                  ? "bg-sky-600 text-white"
                  : "text-slate-700 hover:bg-sky-50"
              }`}
            >
              ภายนอก
            </button>
          </div>
        </div>

        {/* กราฟสองคอลัมน์ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* รายสัปดาห์ */}
          <section className="bg-white/90 backdrop-blur border border-sky-100 shadow-[0_8px_24px_-10px_rgba(30,64,175,0.25)] rounded-2xl p-6">
            <header className="mb-4">
              <h3 className="text-lg font-semibold tracking-tight text-indigo-900">
                สถิติรายสัปดาห์ (รถเข้า)
              </h3>
              <div className="mt-2 h-px bg-gradient-to-r from-sky-200 via-indigo-200 to-transparent" />
            </header>
            <div className="pt-2">
              <WeeklyBarChart data={weeklyInData} color="#b3cde0" />
            </div>
          </section>

          {/* รายวัน */}
          <section className="bg-white/90 backdrop-blur border border-sky-100 shadow-[0_8px_24px_-10px_rgba(30,64,175,0.25)] rounded-2xl p-6">
            <header className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-lg font-semibold tracking-tight text-indigo-900">
                สถิติรายวัน (แยกภายใน/ภายนอก)
                <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 px-1 py-0.5 text-xs font-medium">
                  {dailyDate}
                </span>
              </h3>
              <label className="inline-flex items-center gap-2">
                <span className="text-xs text-slate-500">เลือกวันที่</span>
                <input
                  type="date"
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                  className="px-2 py-2 rounded-lg border border-sky-200 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                />
              </label>
            </header>
            <div className="pt-2">
              <DailyLineChart data={dailySeries} height={260} />
            </div>
          </section>
        </div>

        {/* ตาราง */}
        <section className="bg-white/95 backdrop-blur border border-sky-100 shadow-[0_8px_24px_-10px_rgba(2,132,199,0.25)] rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h3 className="text-lg font-semibold text-indigo-900 tracking-tight">
              รายการล่าสุด
              <span className="ml-2 text-sm font-normal text-slate-500">
                เฉพาะ {dailyDate} (
                {personType === "all"
                  ? "ทั้งหมด"
                  : personType === "inside"
                  ? "ภายใน"
                  : "ภายนอก"}
                )
              </span>
            </h3>
            <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              Items {records.length} items
            </span>
          </div>

          <div className="mt-2 overflow-hidden rounded-xl ring-1 ring-sky-100">
            <RecordsTable records={records} />
          </div>
        </section>
      </div>
    </div>
  );
}
