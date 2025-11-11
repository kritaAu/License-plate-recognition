import { useEffect, useState } from "react";
import Filters from "../components/Filters";
import StatsCards from "../components/StatsCards";
// import LineChart from "../components/LineChart";
import DailyLineChart from "../components/DailyLineChart";
import RecordsTable from "../components/RecordsTable";
import WeeklyBarChart from "../components/WeeklyBarChart";
import { getRecentEvents } from "../services/dashboardApi";
// import { formatThaiDateTime } from "../utils/date";

//  คนใน = นักศึกษา / อาจารย์ / เจ้าหน้าที่
const INTERNAL_ROLES = new Set(["นักศึกษา", "อาจารย์", "เจ้าหน้าที่"]);
const isInternal = (role) => INTERNAL_ROLES.has(String(role ?? "").trim());

export default function Home() {
  const [filters, setFilters] = useState({
    start: "2025-08-01",
    end: "2025-08-09",
    direction: "all",
    query: "",
  });

  const [stats, setStats] = useState({ total: 0, in: 0, out: 0, unknown: 0 });

  // ====== แยกคนใน/คนนอก ======
  const [personType, setPersonType] = useState("all"); // all | inside | outside
  const [countsByRole, setCountsByRole] = useState({ inside: 0, outside: 0 });

  // ตาราง
  const [records, setRecords] = useState([]);
  const [recordsRawForDay, setRecordsRawForDay] = useState([]);

  // กราฟรายวัน
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dailyDate, setDailyDate] = useState(todayStr);
  const [dailySeries, setDailySeries] = useState([]);
  const [rawEvents, setRawEvents] = useState([]);

  // กราฟรายสัปดาห์ (รถเข้า)
  const [weeklyInData, setWeeklyInData] = useState([]);

  useEffect(() => {
    loadRecent();
  }, []);

  useEffect(() => {
    buildDailySeries(rawEvents, dailyDate);
    rebuildRecordsAndStatsForDay(rawEvents, dailyDate);
    setWeeklyInData(buildWeeklyInData(rawEvents));
  }, [rawEvents, dailyDate]);

  // เปลี่ยนกรองคนใน/คนนอก → อัปเดตตารางทันที
  useEffect(() => {
    const filtered =
      personType === "inside"
        ? recordsRawForDay.filter((r) => r.check === "บุคคลภายใน")
        : personType === "outside"
        ? recordsRawForDay.filter((r) => r.check === "บุคคลภายนอก")
        : recordsRawForDay;

    setRecords(filtered);
  }, [personType, recordsRawForDay]);

  const loadRecent = async () => {
    const res = await getRecentEvents();
    const list = Array.isArray(res) ? res : res?.data || [];
    setRawEvents(list);
  };

  // ===== Helper: รายสัปดาห์ (4 บัคเก็ต: 3wk ก่อน + สัปดาห์นี้) =====
  const startOfWeek = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
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
      { label: "3 สัปดาห์ก่อน", start: addDays(thisMon, -21), end: addDays(thisMon, -14) },
      { label: "2 สัปดาห์ก่อน", start: addDays(thisMon, -14), end: addDays(thisMon, -7) },
      { label: "สัปดาห์ก่อน", start: addDays(thisMon, -7), end: addDays(thisMon, 0) },
      { label: "สัปดาห์นี้", start: addDays(thisMon, 0), end: addDays(thisMon, 7) },
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

  // ===== Helper: กราฟรายวัน =====
  const buildDailySeries = (events, dateStr) => {
    if (!Array.isArray(events) || !dateStr) {
      setDailySeries([]);
      return;
    }
    const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
    const day = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);

    const pad = (n) => String(n).padStart(2, "0");
    const keyOf = (dt) =>
      `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(
        dt.getHours()
      )}`;

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

      if ((x.direction || "").toLowerCase() !== "in") continue; // นับเฉพาะเข้า

      const k = keyOf(dt);
      const b = buckets.get(k);
      if (!b) continue;

      //  ใช้ isInternal() แทน "staff"
      const inside = isInternal(x.role);
      if (inside) b.inside += 1;
      else b.outside += 1;
    }

    setDailySeries(Array.from(buckets.values()));
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
      const status = dir === "in" ? "เข้า" : dir === "out" ? "ออก" : e.direction || "-";
      const check = isInternal(e.role) ? "บุคคลภายใน" : "บุคคลภายนอก"; //  แก้จุดนี้

      // เวลา UTC dd/mm/yyyy HH:MM:SS
      let formattedTime = "-";
      if (e.datetime) {
        try {
          const date = new Date(e.datetime);
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, "0");
          const day = String(date.getUTCDate()).padStart(2, "0");
          const hours = String(date.getUTCHours()).padStart(2, "0");
          const minutes = String(date.getUTCMinutes()).padStart(2, "0");
          const seconds = String(date.getUTCSeconds()).padStart(2, "0");
          formattedTime = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
        } catch {
          formattedTime = "Invalid Date";
        }
      }

      return {
        time: formattedTime,
        plate: `${e.plate || "-"}${e.province ? " จ." + e.province : ""}`,
        status,
        check,
        imgUrl: e.image || null,
        _raw: e,
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

    //  ใช้ isInternal() ในการนับ
    const insideCount = filtered.filter((x) => isInternal(x.role)).length;
    const outsideCount = filtered.length - insideCount;
    setCountsByRole({ inside: insideCount, outside: outsideCount });
  };

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
    <div className="min-h-screen bg-gradient-to-br from-white to-blue-400">
      <div className="mx-auto max-w-5xl px-3" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ฟิลเตอร์ */}
        <div className="hidden bg-white/70 backdrop-blur border border-sky-100 shadow-sm rounded-2xl p-6 mb-6">
          <Filters
            filters={filters}
            setFilters={setFilters}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
          />
        </div>

        {/* การ์ดสถิติเดิม */}
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

          <div className="inline-flex rounded-xl border border-sky-200 bg-white p-1 text-sm">
            <button
              onClick={() => setPersonType("all")}
              className={`px-3 py-1 rounded-lg ${
                personType === "all" ? "bg-sky-600 text-white" : "text-slate-700"
              }`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => setPersonType("inside")}
              className={`px-3 py-1 rounded-lg ${
                personType === "inside"
                  ? "bg-sky-600 text-white"
                  : "text-slate-700"
              }`}
            >
              ภายใน
            </button>
            <button
              onClick={() => setPersonType("outside")}
              className={`px-3 py-1 rounded-lg ${
                personType === "outside"
                  ? "bg-sky-600 text-white"
                  : "text-slate-700"
              }`}
            >
              ภายนอก
            </button>
          </div>
        </div>

        {/* กราฟสองคอลัมน์ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* รายสัปดาห์ (รถเข้า) */}
          <section className="bg-white/90 backdrop-blur border border-sky-100 shadow-[0_8px_24px_-10px_rgba(30,64,175,0.25)] rounded-2xl p-6 transition hover:shadow-[0_14px_28px_-12px_rgba(30,64,175,0.35)]">
            <header className="mb-4">
              <h3 className="text-lg font-semibold tracking-tight text-indigo-900">
                สถิติรายสัปดาห์ (รถเข้า)
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                แสดง 3 สัปดาห์ก่อน + สัปดาห์นี้ (นับเฉพาะเหตุการณ์เข้า)
              </p>
              <div className="mt-2 h-px bg-gradient-to-r from-sky-200 via-indigo-200 to-transparent" />
            </header>
            <div className="pt-2">
              <WeeklyBarChart data={weeklyInData} />
            </div>
          </section>

          {/* รายวัน */}
          <section className="bg-white/90 backdrop-blur border border-sky-100 shadow-[0_8px_24px_-10px_rgba(30,64,175,0.25)] rounded-2xl p-6 transition hover:shadow-[0_14px_28px_-12px_rgba(30,64,175,0.35)]">
            <header className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-lg font-semibold tracking-tight text-indigo-900">
                สถิติรายวัน (แยกภายใน/ภายนอก)
                <span className="ml-2 align-middle inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 px-1 py-0.5 text-xs font-medium">
                  {dailyDate}
                </span>
              </h3>
              <label className="inline-flex items-center gap-2">
                <span className="text-xs text-slate-500">เลือกวันที่</span>
                <input
                  type="date"
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                  className="px-2 py-2 rounded-lg border border-sky-200 text-sm bg-white text-slate-700
                             focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                />
              </label>
            </header>
            <div className="pt-2">
              <DailyLineChart series={dailySeries} />
            </div>
          </section>
        </div>

        {/* ตารางรายการ */}
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