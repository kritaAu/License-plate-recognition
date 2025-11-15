// src/navbar.jsx (ปรับให้เข้ากับโครงสร้างเดิม)
import { NavLink, useNavigate } from "react-router-dom";

const AuthService = {
  logout: () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
  },
  getUser: () => {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  },
};

const TABS = [
  { to: "/", label: "Home" },
  { to: "/search", label: "Search" },
  { to: "/member", label: "Member" },
];

export default function Navbar() {
  const navigate = useNavigate();
  const user = AuthService.getUser();

  const handleLogout = () => {
    AuthService.logout();
    navigate("/login");
  };

  return (
    <header className="w-full bg-[#12305a] text-white shadow-sm sticky top-0 z-50">
      {/* Desktop Navbar */}
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
        <div className="flex h-16 items-stretch justify-between">
          {/* ส่วนซ้าย: Brand + Links */}
          <div className="flex items-stretch">
            {/* Brand */}
            <div className="flex items-center px-2 sm:px-3">
              <span className="text-lg sm:text-xl font-semibold tracking-wide">
                ระบบตรวจจับรถจักรยานยนต์
              </span>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-stretch ml-4">
              {TABS.map((t, i) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  className={({ isActive }) =>
                    [
                      "px-5 flex items-center text-lg font-medium",
                      "border-r border-black/30",
                      i === 0 ? "border-l border-black/30" : "",
                      isActive
                        ? "bg-[#c9d9e8] text-[#0b1b36]"
                        : "hover:bg-white/10",
                    ].join(" ")
                  }
                >
                  {t.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* ส่วนขวา: User Info + Logout */}
          <div className="flex items-center gap-3">
            {/* แสดงชื่อ User */}
            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/10 rounded-lg">
                <span className="text-sm font-medium">👤 {user.username}</span>
                <span className="text-xs opacity-75">
                  ({user.role === "admin" ? "ผู้ดูแล" : "พนักงาน"})
                </span>
              </div>
            )}

            {/* ปุ่ม Logout */}
            <button
              onClick={handleLogout}
              className="rounded-xl bg-[#b11c1b] hover:bg-[#971616] px-5 py-2 text-lg font-semibold shadow transition-colors"
              title="ออกจากระบบ"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navbar */}
      <nav className="md:hidden flex divide-x divide-black/30 border-t border-black/30">
        {TABS.map((t, i) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              [
                "flex-1 text-center py-2 text-sm font-medium",
                "border-r border-black/30",
                i === 0 ? "border-l border-black/30" : "",
                isActive
                  ? "bg-[#c9d9e8] text-[#0b1b36]"
                  : "text-white hover:bg-white/10",
              ].join(" ")
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
