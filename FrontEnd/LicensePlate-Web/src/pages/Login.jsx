// src/pages/LoginPage.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { login, fetchDashboardDaily } from "../services/api";


const API = (
  import.meta.env?.VITE_API_BASE_URL || "https://license-plate-recognition-wlxn.onrender.com"
).replace(/\/$/, "");

// ===== Auth utilities =====
const AuthService = {
  setToken: (token) => localStorage.setItem("auth_token", token),
  getToken: () => localStorage.getItem("auth_token"),
  removeToken: () => localStorage.removeItem("auth_token"),
  setUser: (user) => localStorage.setItem("user", JSON.stringify(user)),
  getUser: () => {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  },
  removeUser: () => localStorage.removeItem("user"),
  isAuthenticated: () => !!AuthService.getToken(),
  logout: () => {
    AuthService.removeToken();
    AuthService.removeUser();
  },
};

const pad2 = (n) => String(n).padStart(2, "0");
function dateToYMD(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function LoginPage() {
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [todayStats, setTodayStats] = useState({ in: 0, out: 0 });
  const [currentTime, setCurrentTime] = useState(new Date());

  // ===== ดึงสถิติวันนี้จาก /events (ใช้ useCallback ให้ ref คงที่) =====
 const fetchTodayStatsFromEvents = useCallback(async () => {
  try {
    const todayStr = dateToYMD(new Date());
    const hourly = await fetchDashboardDaily(todayStr);

    const inCount = hourly.reduce(
      (sum, h) => sum + (h.inside ?? h.in ?? 0),
      0
    );
    const outCount = hourly.reduce(
      (sum, h) => sum + (h.outside ?? h.out ?? 0),
      0
    );

    setTodayStats({ in: inCount, out: outCount });
  } catch (err) {
    console.error("Error fetching stats:", err);
    setTodayStats({ in: 0, out: 0 });
  }
}, []);


  // ===== initial effect =====
  useEffect(() => {
  if (AuthService.isAuthenticated()) {
    setIsLoggedIn(true);
  }

  // ดึงข้อมูลวันนี้
  fetchTodayStatsFromEvents();

  const timer = setInterval(() => {
    setCurrentTime(new Date());
  }, 1000);

  return () => clearInterval(timer);
}, [fetchTodayStatsFromEvents]);  // อย่าลืมใส่ใน dependency


  // ===== login / logout =====
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "เข้าสู่ระบบไม่สำเร็จ");
      }

      AuthService.setToken(data.access_token);
      AuthService.setUser(data.user);

      // ถ้าหน้านี้เป็น /login ให้เด้งไป Dashboard ที่ "/"
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    AuthService.logout();
    setIsLoggedIn(false);
    setUsername("");
    setPassword("");
  };

  // ===== formatter วันที่/เวลา =====
  const formatDate = (date) =>
    date.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const formatTime = (date) =>
    date.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  // ===== UI เมื่อ login แล้ว (ถ้ามี route ใช้หน้านี้เป็นหน้า Profile/login ซ้ำ) =====
  if (isLoggedIn) {
    const user = AuthService.getUser();

    return (
      <div className="min-h-screen bg-earth-950 flex flex-col justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-earth-900/30 via-earth-950 to-earth-950 -z-10" />
        <div className="max-w-6xl w-full mx-auto">
          <div className="bg-earth-900/80 backdrop-blur-xl border border-earth-800 rounded-3xl shadow-2xl p-6 mb-8 flex flex-col sm:flex-row gap-4 justify-between items-center text-center sm:text-left relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-earth-500/10 to-earth-400/10 pointer-events-none" />
            <div className="relative z-10">
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                ยินดีต้อนรับ, <span className="bg-gradient-to-r from-earth-400 to-earth-300 bg-clip-text text-transparent">{user?.username}</span>
              </h1>
              <p className="text-sm text-earth-400 mt-2 font-medium">
                เข้าสู่ระบบในฐานะ: <span className="text-earth-300 bg-earth-500/10 px-2 py-0.5 rounded-md">{user?.role === "admin" ? "ผู้ดูแลระบบ" : "พนักงาน"}</span>
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="relative z-10 bg-terra-500 hover:bg-terra-600 text-white font-semibold px-6 py-2.5 rounded-xl transition-all duration-300 shadow-[0_4px_14px_0_rgba(202,112,68,0.39)] hover:shadow-[0_6px_20px_rgba(202,112,68,0.23)] hover:-translate-y-0.5"
            >
              ออกจากระบบ
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-earth-900/60 backdrop-blur-xl border border-earth-800/80 rounded-3xl p-10 shadow-2xl relative overflow-hidden group">
              <div className="absolute -inset-px bg-gradient-to-r from-earth-500/20 to-earth-400/20 opacity-0 group-hover:opacity-100 transition duration-500" />
              <div className="relative z-10 text-center flex flex-col justify-center h-full">
                <p className="text-earth-400 font-medium mb-3 uppercase tracking-widest text-sm">วันที่</p>
                <h2 className="text-4xl font-extrabold text-white mb-6 tracking-tight">
                  {formatDate(currentTime)}
                </h2>
                <div className="w-16 h-px bg-earth-700 mx-auto mb-6" />
                <p className="text-earth-400 font-medium mb-3 uppercase tracking-widest text-sm">เวลา</p>
                <h2 className="text-6xl font-black bg-gradient-to-br from-white to-earth-400 bg-clip-text text-transparent drop-shadow-sm">
                  {formatTime(currentTime)}
                </h2>
              </div>
            </div>

            <div className="bg-earth-900/60 backdrop-blur-xl border border-earth-800/80 rounded-3xl p-10 shadow-2xl relative overflow-hidden">
              <h3 className="text-xl font-bold text-white mb-8 text-center tracking-wide flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-earth-400 animate-pulse"></span>
                ภาพรวมสถิติวันนี้
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-earth-800/50 backdrop-blur-sm rounded-2xl p-6 shadow-inner border border-emerald-500/20 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="text-sm text-emerald-400 mb-2 font-semibold uppercase tracking-wider text-center">
                    เข้ารถ (IN)
                  </p>
                  <p className="text-6xl font-black text-white text-center drop-shadow-md">
                    {todayStats.in}
                  </p>
                </div>

                <div className="bg-earth-800/50 backdrop-blur-sm rounded-2xl p-6 shadow-inner border border-rose-500/20 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="text-sm text-rose-400 mb-2 font-semibold uppercase tracking-wider text-center">
                    ออกรถ (OUT)
                  </p>
                  <p className="text-6xl font-black text-white text-center drop-shadow-md">
                    {todayStats.out}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="md:col-span-2 text-center mt-4">
              <button 
                onClick={() => navigate('/')} 
                className="inline-flex items-center gap-2 bg-earth-800 hover:bg-earth-700 text-white px-8 py-3 rounded-xl border border-earth-600 transition-colors shadow-lg"
              >
                เข้าสู่ Dashboard
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-earth-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-earth-900/40 via-earth-950 to-earth-950 -z-10" />
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-5 rounded-[2.5rem] border border-earth-800/80 bg-earth-900/60 backdrop-blur-2xl overflow-hidden shadow-2xl">
        
        {/* เลย์เอาต์ซ้าย (ฟอร์ม Login) */}
        <div className="md:col-span-2 p-10 md:p-14 flex flex-col justify-center relative bg-earth-900/50">
          <div className="mb-10">
            <div className="inline-flex items-center justify-center p-3 bg-earth-500/10 rounded-2xl mb-4 border border-earth-500/20 shadow-[0_0_15px_rgba(88,129,87,0.15)]">
               <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-earth-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></svg>
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              เข้าสู่ระบบ
            </h2>
            <p className="text-earth-400 mt-2 text-sm font-medium">LPR Admin Panel ควบคุมระบบจอดรถ</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-earth-300 mb-2">
                ชื่อผู้ใช้งาน (Username)
              </label>
              <input
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-earth-700 bg-earth-950 text-earth-200 placeholder-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50 focus:border-earth-500 disabled:opacity-50 transition-all font-medium shadow-inner"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-earth-300 mb-2">
                รหัสผ่าน (Password)
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl border border-earth-700 bg-earth-950 text-earth-200 placeholder-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50 focus:border-earth-500 disabled:opacity-50 transition-all font-medium shadow-inner"
              />
            </div>

            {error && (
              <div className="bg-terra-500/10 border border-terra-500/30 text-terra-500 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full bg-earth-600 hover:bg-earth-500 text-white font-bold py-3.5 rounded-xl transition-all duration-300 shadow-[0_4px_14px_0_rgba(88,129,87,0.39)] hover:shadow-[0_6px_20px_rgba(88,129,87,0.23)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mt-4 text-sm tracking-wide uppercase"
            >
              {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบเลย"}
            </button>
          </form>
        </div>

        {/* เลย์เอาต์ขวา (Dashboard Stats & Clock) */}
        <div className="md:col-span-3 bg-earth-800/20 border-l border-earth-800/60 p-10 md:p-16 flex flex-col justify-between py-12 relative">
           <div className="absolute inset-0 bg-gradient-to-t from-earth-900 via-transparent to-earth-900/50 pointer-events-none" />
           <div className="relative z-10 flex flex-col h-full justify-center space-y-12">
            
            <div className="text-center group cursor-default">
              <h2 className="text-base font-semibold text-earth-400 mb-3 tracking-widest uppercase">
                {formatDate(currentTime)}
              </h2>
              <p className="text-7xl lg:text-8xl font-black bg-gradient-to-b from-white via-earth-200 to-earth-500 bg-clip-text text-transparent drop-shadow-xl transition-all duration-700 group-hover:scale-105">
                {formatTime(currentTime)}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-center gap-2 mb-6 opacity-70">
                <div className="h-px w-8 bg-earth-600"></div>
                <span className="text-xs font-semibold uppercase tracking-widest text-earth-400">ระบบประมวลผลวันนี้</span>
                <div className="h-px w-8 bg-earth-600"></div>
              </div>
              
              <div className="grid grid-cols-2 gap-6 lg:gap-8 max-w-sm mx-auto">
                <div className="bg-earth-900/80 backdrop-blur-md rounded-2xl p-6 shadow-2xl border-t-2 border-t-emerald-500 border-x border-b border-earth-700 hover:-translate-y-1 transition duration-300">
                  <p className="text-xs text-emerald-400 mb-3 font-semibold uppercase tracking-widest text-center">
                    เข้า (In)
                  </p>
                  <p className="text-5xl font-black text-white text-center drop-shadow-lg">{todayStats.in}</p>
                </div>

                <div className="bg-earth-900/80 backdrop-blur-md rounded-2xl p-6 shadow-2xl border-t-2 border-t-rose-500 border-x border-b border-earth-700 hover:-translate-y-1 transition duration-300">
                  <p className="text-xs text-rose-400 mb-3 font-semibold uppercase tracking-widest text-center">
                    ออก (Out)
                  </p>
                  <p className="text-5xl font-black text-white text-center drop-shadow-lg">{todayStats.out}</p>
                </div>
              </div>
            </div>

           </div>
        </div>
      </div>
    </div>
  );
}
