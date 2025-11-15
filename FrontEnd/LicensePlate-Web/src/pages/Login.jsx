// src/pages/LoginPage.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

// ใช้รูปแบบเดียวกับหน้า Home / Search
const API = (
  import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000"
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

// ===== ฟังก์ชันเดียวกับ Home.jsx =====
function getDirectionCode(ev = {}) {
  const rawDir = (ev.direction ?? "").toString().trim().toUpperCase();
  const statusStr = (ev.status ?? "").toString();

  if (rawDir === "IN" || statusStr.includes("เข้า")) return "IN";
  if (rawDir === "OUT" || statusStr.includes("ออก")) return "OUT";
  return "UNKNOWN";
}

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
    const todayStr = dateToYMD(new Date()); // YYYY-MM-DD แบบเดียวกับ backend

    // ✓ เปลี่ยนมาใช้ /dashboard/daily แทน /events
    const res = await fetch(`${API}/dashboard/daily?date=${todayStr}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const hourly = await res.json(); // รูปแบบ: [{ label, inside, outside }, ... ]

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
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg p-6 mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                ยินดีต้อนรับ, {user?.username}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                บทบาท: {user?.role === "admin" ? "ผู้ดูแลระบบ" : "พนักงาน"}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-2 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              ออกจากระบบ
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-indigo-200 to-purple-300 rounded-2xl p-8 shadow-lg">
              <div className="text-center">
                <p className="text-gray-700 font-medium mb-2">วันที่</p>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  {formatDate(currentTime)}
                </h2>
                <p className="text-gray-700 font-medium mb-2">เวลา</p>
                <h2 className="text-5xl font-bold text-gray-900">
                  {formatTime(currentTime)} น.
                </h2>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur rounded-2xl p-8 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">
                สถิติวันนี้
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-green-200 to-green-300 rounded-xl p-6 shadow-md border-2 border-green-400">
                  <p className="text-sm text-gray-700 mb-2 font-medium">
                    เข้า (In)
                  </p>
                  <p className="text-5xl font-bold text-gray-800">
                    {todayStats.in}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-red-200 to-red-300 rounded-xl p-6 shadow-md border-2 border-red-400">
                  <p className="text-sm text-gray-700 mb-2 font-medium">
                    ออก (Out)
                  </p>
                  <p className="text-5xl font-bold text-gray-800">
                    {todayStats.out}
                  </p>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 bg-white/80 backdrop-blur rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-center gap-3">
                <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-lg font-semibold text-gray-700">
                  ระบบทำงานปกติ
                </span>
              </div>
            </div>

            <div className="md:col-span-2 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-2xl p-8 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
                เมนูด่วน
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button className="bg-white hover:bg-gray-50 rounded-lg p-4 shadow-md transition-all duration-200 hover:shadow-lg">
                  <div className="text-3xl mb-2">📊</div>
                  <div className="text-sm font-medium text-gray-700">
                    รายงาน
                  </div>
                </button>
                <button className="bg-white hover:bg-gray-50 rounded-lg p-4 shadow-md transition-all duration-200 hover:shadow-lg">
                  <div className="text-3xl mb-2">🔍</div>
                  <div className="text-sm font-medium text-gray-700">
                    ค้นหา
                  </div>
                </button>
                <button className="bg-white hover:bg-gray-50 rounded-lg p-4 shadow-md transition-all duration-200 hover:shadow-lg">
                  <div className="text-3xl mb-2">👥</div>
                  <div className="text-sm font-medium text-gray-700">
                    สมาชิก
                  </div>
                </button>
                <button className="bg-white hover:bg-gray-50 rounded-lg p-4 shadow-md transition-all duration-200 hover:shadow-lg">
                  <div className="text-3xl mb-2">⚙️</div>
                  <div className="text-sm font-medium text-gray-700">
                    ตั้งค่า
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== UI หน้า login ปกติ =====
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-3xl overflow-hidden shadow-2xl">
        <div className="bg-white p-8 md:p-12 flex flex-col justify-center">
          <h2 className="text-4xl font-bold text-slate-800 mb-8 text-center">
            เข้าสู่ระบบ
          </h2>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Username
              </label>
              <input
                type="text"
                placeholder="ชื่อผู้ใช้ (admin)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Password
              </label>
              <input
                type="password"
                placeholder="รหัสผ่าน (password)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition"
              />
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full bg-gradient-to-r from-indigo-600 to-sky-500 hover:from-indigo-700 hover:to-sky-600 text-white font-semibold py-3 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-indigo-600 disabled:hover:to-sky-500"
            >
              {loading ? "กำลังตรวจสอบ..." : "Login"}
            </button>
          </form>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-indigo-800 p-8 md:p-12 flex flex-col justify-center text-white">
          <div className="text-center mb-8">
            <h2 className="text-xl font-medium text-indigo-200 mb-2">
              {formatDate(currentTime)}
            </h2>
            <p className="text-5xl font-bold text-white">
              {formatTime(currentTime)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-400/50">
              <p className="text-sm text-green-300 mb-2 font-medium">
                เข้า (In)
              </p>
              <p className="text-5xl font-bold text-white">{todayStats.in}</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-red-400/50">
              <p className="text-sm text-red-300 mb-2 font-medium">
                ออก (Out)
              </p>
              <p className="text-5xl font-bold text-white">{todayStats.out}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
