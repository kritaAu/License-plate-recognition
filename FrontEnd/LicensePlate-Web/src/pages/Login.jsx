// src/pages/Login.jsx
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { todayLocalKey, addDays, toLocalDateKey } from "../utils/date";

const API = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  // ==== สถิติของ "วันนี้" ====
  const [stats, setStats] = useState({
    total: "—",
    in: "—",
    out: "—",
    unique: "—",
  });

  // ดึงเหตุการณ์ของ "วันนี้" แล้วสรุปตัวเลข
  useEffect(() => {
    const controller = new AbortController();

    async function loadTodayStats() {
      try {
        const start = todayLocalKey();                       // YYYY-MM-DD (local)
        const end = toLocalDateKey(addDays(new Date(), 1));  // วันถัดไป

        const params = new URLSearchParams({
          start_date: start,
          end_date: end,
          limit: "20000",          // กันกรณีข้อมูลเยอะ
        });

        const res = await fetch(`${API}/events?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);

        const events = (await res.json()) || [];

        const dir = (v) => String(v || "").trim().toLowerCase();
        const total = events.length;
        const inCount = events.filter((e) => dir(e.direction) === "in").length;
        const outCount = events.filter((e) => dir(e.direction) === "out").length;

        // นับป้ายทะเบียนไม่ซ้ำ: ตัดค่าว่าง / "-" / "ไม่มีป้ายทะเบียน" ออก
        const normalizePlate = (p) => String(p || "").trim();
        const uniquePlates = new Set(
          events
            .map((e) => normalizePlate(e.plate))
            .filter((p) => p && p !== "-" && !/^ไม่มีป้าย/i.test(p))
        ).size;

        setStats({
          total,
          in: inCount,
          out: outCount,
          unique: uniquePlates,
        });
      } catch (err) {
        // ถ้าพลาด ให้คง "—" ไว้ ไม่ให้หน้าแตก
        console.error("loadTodayStats error:", err);
      }
    }

    loadTodayStats();
    return () => controller.abort();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(username.trim(), password);
      const to = loc.state?.from?.pathname || "/home";
      nav(to, { replace: true });
    } catch (err) {
      setError(err.message || "ล็อกอินไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* ซ้าย: พื้นหลังไล่สี + การ์ดสรุปของ "วันนี้" */}
      <div className="hidden md:flex flex-col items-center justify-center p-10 bg-gradient-to-b from-sky-400 via-indigo-300 to-rose-200">
        <div className="grid grid-cols-2 gap-6 w-full max-w-xl">
          {[
            { t: "ทั้งหมด",    v: stats.total },
            { t: "เข้า (in)",  v: stats.in },
            { t: "ออก (out)",  v: stats.out },
            { t: "ป้ายทะเบียน", v: stats.unique },
          ].map((c, i) => (
            <div key={i} className="rounded-xl bg-white/90 p-4 shadow">
              <div className="text-slate-700 text-lg">{c.t}</div>
              <div className="text-3xl font-bold mt-1">{c.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ขวา: ฟอร์มล็อกอิน */}
      <div className="flex items-center justify-center bg-[#e8ecff]">
        <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl shadow p-8 m-6">
          <h1 className="text-5xl font-semibold text-center mb-8">Login</h1>

          <label className="block text-sm text-slate-600 mb-1">Username</label>
          <input
            className="w-full rounded-lg border px-3 py-2 mb-4"
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
            required
          />

          <label className="block text-sm text-slate-600 mb-1">Password</label>
          <input
            type="password"
            className="w-full rounded-lg border px-3 py-2 mb-6"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            required
          />

          {error && <div className="mb-4 text-center text-rose-600 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="mx-auto block w-40 rounded-lg bg-lime-200 py-2 text-slate-900 font-medium shadow hover:brightness-105 disabled:opacity-60 rounded-2xl"
          >
            {loading ? "กำลังเข้า..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
