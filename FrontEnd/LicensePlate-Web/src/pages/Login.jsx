import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // ⬅️ เพิ่มบรรทัดนี้

const API =
  (typeof window !== "undefined" && window.VITE_API_BASE_URL) ||
  "http://127.0.0.1:8000";

// Auth utilities
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

export default function LoginPage() {
  const navigate = useNavigate(); // ⬅️ เพิ่มบรรทัดนี้

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [todayStats, setTodayStats] = useState({ in: 0, out: 0 });
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // ตรวจสอบว่า login แล้วหรือยัง
    if (AuthService.isAuthenticated()) {
      setIsLoggedIn(true);
    }

    // ดึงสถิติวันนี้
    fetchTodayStats();

    // อัพเดทเวลาทุก 1 วินาที
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const fetchTodayStats = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(`${API}/dashboard/summary?date=${today}`);
      const data = await res.json();
      setTodayStats({ in: data.in || 0, out: data.out || 0 });
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

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

      // บันทึก token และข้อมูล user
      AuthService.setToken(data.access_token);
      AuthService.setUser(data.user);

      // ⬇️ เพิ่มส่วนนี้: Redirect ไปหน้า Home
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ... (ส่วนที่เหลือเหมือนเดิม)

  const handleLogout = () => {
    AuthService.logout();
    setIsLoggedIn(false);
    setUsername("");
    setPassword("");
  };

  const formatDate = (date) => {
    return date.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // หน้า Dashboard หลัง login
  if (isLoggedIn) {
    const user = AuthService.getUser();

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header with Logout */}
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

          {/* Dashboard Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* DateTime Card */}
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

            {/* Stats Card */}
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

            {/* System Status */}
            <div className="md:col-span-2 bg-white/80 backdrop-blur rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-center gap-3">
                <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-lg font-semibold text-gray-700">
                  ระบบทำงานปกติ
                </span>
              </div>
            </div>

            {/* Quick Actions */}
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
                  <div className="text-sm font-medium text-gray-700">ค้นหา</div>
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

  // หน้า Login
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-0 rounded-3xl overflow-hidden shadow-2xl">
        {/* Left side - Login Form */}
        <div className="bg-gradient-to-br from-blue-200 to-blue-300 p-8 md:p-12 flex flex-col justify-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">
            Login
          </h1>

          <div className="space-y-6">
            <div>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg border-2 border-transparent bg-white/90 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin(e)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg border-2 border-transparent bg-white/90 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading || !username || !password}
              className="w-full bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-gray-800 font-semibold py-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-green-400 disabled:hover:to-green-500"
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "Login"}
            </button>
          </div>
        </div>

        {/* Right side - Stats Display */}
        <div className="bg-gradient-to-br from-blue-300 via-purple-200 to-pink-200 p-8 md:p-12 flex flex-col justify-center">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              วันที่ {formatDate(currentTime)}
            </h2>
            <p className="text-4xl font-bold text-gray-900">
              เวลา {formatTime(currentTime)} น.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-green-200 to-green-300 rounded-2xl p-6 shadow-lg border-2 border-green-400">
              <p className="text-sm text-gray-700 mb-2 font-medium">
                เข้า (In)
              </p>
              <p className="text-5xl font-bold text-gray-800">
                {todayStats.in}
              </p>
            </div>

            <div className="bg-gradient-to-br from-red-200 to-red-300 rounded-2xl p-6 shadow-lg border-2 border-red-400">
              <p className="text-sm text-gray-700 mb-2 font-medium">
                ออก (Out)
              </p>
              <p className="text-5xl font-bold text-gray-800">
                {todayStats.out}
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 bg-white/50 rounded-full px-4 py-2 backdrop-blur-sm">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-gray-700">
                ระบบทำงานปกติ
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
