// src/pages/navbar.jsx  (หรือที่ไฟล์ Navbar ของคุณอยู่)
import { NavLink, useLocation } from "react-router-dom";

const TABS = [
  { to: "/",        label: "Home"   },
  { to: "/search",  label: "Search" },
  { to: "/member",  label: "Member" },
  { to: "/camera",  label: "Camera" },
];

export default function Navbar({ onLogout }) {
  const { pathname } = useLocation();

  const handleLogout = () => {
    try {
      onLogout?.(); // ถ้ามีฟังก์ชันจากข้างนอก
    } finally {
      // เคลียร์ session แบบง่าย ๆ
      localStorage.clear();
      sessionStorage.clear();
      // กลับหน้าแรก
      window.location.href = "/";
    }
  };

  return (
    <header className="w-full bg-[#12305a] text-white shadow-sm">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
        <div className="flex h-16 items-stretch justify-between">
          {/* Brand */}
          <div className="flex items-center px-2 sm:px-3">
            <span className="text-lg sm:text-xl font-semibold tracking-wide">
              ระบบตรวจจับรถจักรยานยนต์
            </span>
          </div>

          {/* Tabs */}
          <nav className="hidden md:flex items-stretch">
            {TABS.map((t, i) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  [
                    "px-8 flex items-center text-lg font-medium",
                    "border-r border-black/30",
                    i === 0 ? "border-l border-black/30" : "",
                    isActive
                      ? "bg-[#c9d9e8] text-[#0b1b36]" // แท็บ active พื้นฟ้าอ่อน ตัวอักษรน้ำเงินเข้ม
                      : "hover:bg-white/10",
                  ].join(" ")
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>

          {/* Log Out */}
          <div className="flex items-center">
            <button
              onClick={handleLogout}
              className="ml-3 rounded-xl bg-[#b11c1b] hover:bg-[#971616] px-5 py-2 text-lg font-semibold shadow"
              title="Log Out"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>

      {/* แถบเมนูในจอเล็ก (ถ้าต้องการให้แสดงเรียงต่อกัน) */}
      <nav className="md:hidden flex divide-x divide-black/30">
        {TABS.map((t, i) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              [
                "flex-1 text-center py-2 text-sm font-medium",
                i === 0 ? "border-l border-black/30" : "",
                "border-r border-black/30",
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
