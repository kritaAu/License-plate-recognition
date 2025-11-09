import { useEffect, useState } from "react";
import Filters from "../components/Filters";
import StatsCards from "../components/StatsCards";
import LineChart from "../components/LineChart";
import DailyLineChart from "../components/DailyLineChart";
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

  const [stats, setStats] = useState({ total: 0, in: 0, out: 0, unknown: 0 });
  const [records, setRecords] = useState([]);
  const [lineData] = useState([]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const [dailyDate, setDailyDate] = useState(todayStr);
  const [dailySeries, setDailySeries] = useState([]);
  const [rawEvents, setRawEvents] = useState([]);

  useEffect(() => {
    loadRecent();
  }, []);

  useEffect(() => {
    buildDailySeries(rawEvents, dailyDate);
    rebuildRecordsAndStatsForDay(rawEvents, dailyDate);
  }, [rawEvents, dailyDate]);

  const loadRecent = async () => {
    const res = await getRecentEvents();
    const list = Array.isArray(res) ? res : res?.data || [];
    setRawEvents(list);
  };

  const buildDailySeries = (events, dateStr) => {
    if (!Array.isArray(events) || !dateStr) {
      setDailySeries([]);
      return;
    }
    const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
    const day = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);

    const pad = (n) => String(n).padStart(2, "0");
    const keyOf = (dt) =>
      `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}`;

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

      if ((x.direction || "").toLowerCase() !== "in") continue;

      const k = keyOf(dt);
      const b = buckets.get(k);
      if (!b) continue;

      const isInside = (x.role || "").toLowerCase() === "staff";
      if (isInside) b.inside += 1;
      else b.outside += 1;
    }

    setDailySeries(Array.from(buckets.values()));
  };

  const rebuildRecordsAndStatsForDay = (events, dateStr) => {
    if (!Array.isArray(events) || !dateStr) {
      setRecords([]);
      setStats({ total: 0, in: 0, out: 0, unknown: 0 });
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

    const inCount = filtered.filter((x) => (x.direction || "").toLowerCase() === "in").length;
    const outCount = filtered.filter((x) => (x.direction || "").toLowerCase() === "out").length;
    const unknownCount = filtered.filter((x) => !x.plate || x.plate === "-").length;
    setStats({ total: filtered.length, in: inCount, out: outCount, unknown: unknownCount });
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
   <div className="min-h-screen">
  <div className="mx-auto max-w-7xl px-0 py-0"/>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ฟิลเตอร์  */}
        <div className="hidden bg-white/70 backdrop-blur border border-sky-100 shadow-sm rounded-2xl p-6 mb-6">
          <Filters
            filters={filters}
            setFilters={setFilters}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
          />
        </div>

        {/* การ์ดสถิติ */}
        <div className="mb-6">
          <StatsCards stats={stats} />
        </div>

        {/* กราฟสองคอลัมน์ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* รายเดือน */}
          <section className="bg-white/90 backdrop-blur border border-sky-100 shadow-[0_8px_24px_-10px_rgba(30,64,175,0.25)] rounded-2xl p-6 transition hover:shadow-[0_14px_28px_-12px_rgba(30,64,175,0.35)]">
            <header className="mb-4">
              <h3 className="text-lg font-semibold tracking-tight text-indigo-900">
                สถิติรายเดือน
              </h3>
              <div className="mt-2 h-px bg-gradient-to-r from-sky-200 via-indigo-200 to-transparent" />
            </header>
            <div className="pt-2">
              <LineChart data={lineData} />
            </div>
          </section>

          {/* รายวัน */}
          <section className="bg-white/90 backdrop-blur border border-sky-100 shadow-[0_8px_24px_-10px_rgba(30,64,175,0.25)] rounded-2xl p-6 transition hover:shadow-[0_14px_28px_-12px_rgba(30,64,175,0.35)]">
            <header className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-lg font-semibold tracking-tight text-indigo-900">
                สถิติรายวัน (แยกภายใน/ภายนอก)
                <span className="ml-2 align-middle inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-xs font-medium">
                  {dailyDate}
                </span>
              </h3>
              <label className="inline-flex items-center gap-2">
                <span className="text-xs text-slate-500">เลือกวันที่</span>
                <input
                  type="date"
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-sky-200 text-sm bg-white text-slate-700
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
              <span className="ml-2 text-sm font-normal text-slate-500">เฉพาะ {dailyDate}</span>
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