import { useEffect, useRef, useState } from "react";
import Filters from "../components/Filters";
import StatsCards from "../components/StatsCards";
import DailyLineChart from "../components/DailyLineChart";
import RecordsTable from "../components/RecordsTable";
import WeeklyBarChart from "../components/WeeklyBarChart";
import { formatThaiDateTime } from "../utils/date";

// ===== API / WS URL =====
const API = (
  import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
const WS_URL =
  (import.meta.env?.VITE_WS_URL || API.replace(/^http/i, "ws")) + "/ws/events";

// ===== helpers =====
function isInsideRole(role) {
  const r = String(role || "").trim();
  const rl = r.toLowerCase();
  if (["นักศึกษา", "อาจารย์", "เจ้าหน้าที่"].includes(r)) return true;
  if (["staff", "employee", "internal", "insider"].includes(rl)) return true;
  return false;
}

const isUnknownPlate = (plate) => {
  const s = String(plate ?? "").trim();
  if (!s || s === "-") return true;

  const n = s.replace(/\s+/g, "").toLowerCase();
  const th = [
    "ไม่มีป้ายทะเบียน",
    "ไม่มีทะเบียน",
    "ไม่ทราบ",
    "ไม่พบป้าย",
  ];
  const en = [
    "unknown",
    "no plate",
    "noplate",
    "n/a",
    "na",
    "null",
    "none",
    "unk",
  ];

  if (th.some((k) => n.includes(k.replace(/\s+/g, "")))) return true;
  if (en.some((k) => n.includes(k.replace(/\s+/g, "")))) return true;

  return false;
};

// direction ปรับให้เป็น "IN" | "OUT" | "UNKNOWN" ใช้ที่เดียวทุกที่
function getDirectionCode(ev = {}) {
  const rawDir = (ev.direction ?? "").toString().trim().toUpperCase();
  const statusStr = (ev.status ?? "").toString();

  if (rawDir === "IN" || statusStr.includes("เข้า")) return "IN";
  if (rawDir === "OUT" || statusStr.includes("ออก")) return "OUT";
  return "UNKNOWN";
}

// yyyy-mm-dd local
const pad2 = (n) => String(n).padStart(2, "0");
function todayLocalStr() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate()
  )}`;
}
function dateToYMD(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function Home() {
  const [filters, setFilters] = useState({
    start: "",
    end: "",
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

  // raw events (ย้อนหลัง 30 วัน + WS)
  const [rawEvents, setRawEvents] = useState([]);

  // รายสัปดาห์
  const [weeklyInOutData, setWeeklyInOutData] = useState([]);

  // WebSocket
  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const stopRef = useRef(false);

  // โหลดย้อนหลัง 30 วันครั้งแรก
  useEffect(() => {
    loadRecentEvents();
  }, []);

  // rebuild ตาราง/สถิติ/กราฟรายวัน/สัปดาห์ ทุกครั้งที่ rawEvents หรือ dailyDate เปลี่ยน
  useEffect(() => {
    rebuildRecordsAndStatsForDay(rawEvents, dailyDate); // รวมกราฟรายวันอยู่ข้างใน
    setWeeklyInOutData(buildWeeklyInOutData(rawEvents));
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

  // ---- WebSocket: ต่ออัตโนมัติ + auto reconnect ----
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
          if (!data?.datetime && !data?.time) return;
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
  }, []);

  // ===== โหลดข้อมูลย้อนหลัง 30 วันจาก /events =====
  const loadRecentEvents = async () => {
    try {
      const endDate = new Date(); // วันนี้
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // ย้อนหลัง 30 วัน

      const params = new URLSearchParams();
      params.set("start_date", dateToYMD(startDate));
      params.set("end_date", dateToYMD(endDate));
      params.set("limit", "10000");

      const res = await fetch(`${API}/events?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.data || [];
      setRawEvents(list);
    } catch (e) {
      console.error(e);
      setRawEvents([]);
    }
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

  const buildWeeklyInOutData = (events) => {
    if (!Array.isArray(events)) return [];
    const weeks = buildWeekRanges();
    const out = weeks.map((w) => ({ label: w.label, in: 0, out: 0 }));

    for (const e of events) {
      const dt = new Date(e.datetime || e.time);
      if (Number.isNaN(+dt)) continue;

      const dirCode = getDirectionCode(e);

      for (let i = 0; i < weeks.length; i++) {
        const { start, end } = weeks[i];
        if (dt >= start && dt < end) {
          if (dirCode === "IN") out[i].in += 1;
          else if (dirCode === "OUT") out[i].out += 1;
          break;
        }
      }
    }
    return out;
  };

  // ===== Helper: ตาราง + สถิติ + กราฟรายวันของวันหนึ่ง =====
  const rebuildRecordsAndStatsForDay = (events, dateStr) => {
    if (!Array.isArray(events) || !dateStr) {
      setRecords([]);
      setRecordsRawForDay([]);
      setStats({ total: 0, in: 0, out: 0, unknown: 0 });
      setCountsByRole({ inside: 0, outside: 0 });
      setDailySeries([]);
      return;
    }
    const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
    const day = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);

    const filtered = events.filter((e) => {
      const dt = new Date(e.datetime || e.time);
      if (isNaN(dt)) return false;
      return (
        dt.getFullYear() === day.getFullYear() &&
        dt.getMonth() === day.getMonth() &&
        dt.getDate() === day.getDate()
      );
    });

    // ===== กราฟรายวัน: ใช้ข้อมูลเดียวกับตาราง (realtime 100%) =====
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      label: `${pad2(hour)}:00`,
      in: 0,
      out: 0,
    }));

    for (const ev of filtered) {
      const dtVal = ev.datetime || ev.time;
      const dt = new Date(dtVal);
      if (Number.isNaN(+dt)) continue;

      const h = dt.getHours();
      const dirCode = getDirectionCode(ev);
      if (dirCode === "IN") buckets[h].in += 1;
      else if (dirCode === "OUT") buckets[h].out += 1;
    }
    setDailySeries(buckets);

    // ===== ตาราง =====
    const mapped = filtered.map((e) => {
      const dirCode = getDirectionCode(e);
      const status =
        dirCode === "IN" ? "เข้า" : dirCode === "OUT" ? "ออก" : "-";

      const check = isInsideRole(e.role) ? "บุคคลภายใน" : "บุคคลภายนอก";
      const formattedTime = formatThaiDateTime(e.datetime || e.time);

      const memberName =
        e.member_name ||
        e.driver_name ||
        e.owner_name ||
        e.full_name ||
        e.name ||
        null;

      const memberDept = e.member_department || e.department || e.dept || null;
      const plateStr = isUnknownPlate(e.plate)
        ? "ไม่มีป้ายทะเบียน"
        : e.plate || "-";
      return {
        time: formattedTime,
        plate: `${plateStr}${e.province ? " จ." + e.province : ""}`,
        status,
        check,
        imgUrl: e.image || e.blob || null,
        member_name: memberName,
        member_department: memberDept,
        _raw: {
          ...e,
          member_name: memberName,
          member_department: memberDept,
        },
      };
    });

    setRecordsRawForDay(mapped);

    // ===== การ์ดสถิติ =====
    const inCount = filtered.filter((x) => getDirectionCode(x) === "IN").length;
    const outCount = filtered.filter((x) => getDirectionCode(x) === "OUT")
      .length;
    const unknownCount = filtered.filter((x) => isUnknownPlate(x.plate))
      .length;

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

  const handleApplyFilters = () => loadRecentEvents();
  const handleResetFilters = () => {
    setFilters({
      start: "",
      end: "",
      direction: "all",
      query: "",
    });
    loadRecentEvents();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-blue-400">
      <div className="mx-auto max-w-5xl px-3" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ฟิลเตอร์ (ซ่อน) */}
        <div className="mb-6 hidden rounded-2xl border border-sky-100 bg-white/70 p-6 shadow-sm backdrop-blur">
          <Filters
            filters={filters}
            setFilters={setFilters}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
          />
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
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* รายสัปดาห์ */}
          <section className="rounded-2xl border border-sky-100 bg-white/90 p-6 shadow-[0_8px_24px_-10px_rgba(30,64,175,0.25)] backdrop-blur">
            <header className="mb-4">
              <h3 className="text-lg font-semibold tracking-tight text-indigo-900">
                สถิติรายสัปดาห์ (เข้า-ออก)
              </h3>
              <div className="mt-2 h-px bg-gradient-to-r from-sky-200 via-indigo-200 to-transparent" />
            </header>
            <div className="pt-2">
              <WeeklyBarChart data={weeklyInOutData} />
            </div>
          </section>

          {/* รายวัน */}
          <section className="rounded-2xl border border-sky-100 bg-white/90 p-6 shadow-[0_8px_24px_-10px_rgba(30,64,175,0.25)] backdrop-blur">
            <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold tracking-tight text-indigo-900">
                สถิติรายวัน (เข้า-ออก)
                <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-1 py-0.5 text-xs font-medium text-indigo-700">
                  {dailyDate}
                </span>
              </h3>
              <label className="inline-flex items-center gap-2">
                <span className="text-xs text-slate-500">เลือกวันที่</span>
                <input
                  type="date"
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                  className="rounded-lg border border-sky-200 bg-white px-2 py-2 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </label>
            </header>
            <div className="pt-2">
              <DailyLineChart data={dailySeries} height={280} fontScale={1.4} />
            </div>
          </section>
        </div>

        {/* ตาราง */}
        <section className="rounded-2xl border border-sky-100 bg-white/95 p-6 shadow-[0_8px_24px_-10px_rgba(2,132,199,0.25)] backdrop-blur">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold tracking-tight text-indigo-900">
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
