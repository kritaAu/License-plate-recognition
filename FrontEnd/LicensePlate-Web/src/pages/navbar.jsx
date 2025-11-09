// src/pages/navbar.jsx (ฉบับแก้ไข)
import { NavLink, useLocation } from "react-router-dom";

const TABS = [
  { to: "/",        label: "Home"   },
  { to: "/search",  label: "Search" },
  { to: "/member",  label: "Member" },
  // { to: "/camera",  label: "Camera" },
];

export default function Navbar({ onLogout }) {
  const { pathname } = useLocation();

  const handleLogout = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <header className="w-full bg-[#12305a] text-white shadow-sm sticky top-0 z-50">
      
      {/* 1. Desktop Navbar (Layout 2 ส่วน: ซ้าย และ ขวา) */}
      <div className="mx-auto max-w-1xl px-3 sm:px-4 lg:px-6">
        {/* 🌟 ใช้ justify-between เพื่อดัน 2 ส่วนหลักออกจากกัน */}
        <div className="flex h-16 items-stretch justify-between">
          
          {/* 🌟 ส่วนซ้าย (รวม Brand และ Links) 🌟 */}
          <div className="flex items-stretch"> 
            {/* Brand */}
            <div className="flex items-center px-2 sm:px-3">
              <span className="text-lg sm:text-xl font-semibold tracking-wide">
                ระบบตรวจจับรถจักรยานยนต์
              </span>
            </div>

            {/* Tabs (ย้ายมาไว้ข้าง Brand) */}
            <nav className="hidden md:flex items-stretch ml-4"> {/* 🌟 เพิ่ม ml-4 (margin-left) เพื่อเว้นวรรค */}
              {TABS.map((t, i) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  className={({ isActive }) =>
                    [
                      "px-5 flex items-center text-lg font-medium", // 🌟 ลด Padding (px-5)
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
          {/* 🌟 สิ้นสุดส่วนซ้าย 🌟 */}


          {/* ส่วนขวา: ปุ่ม Log Out (เหมือนเดิม) */}
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

      {/* 2. Mobile Navbar (เหมือนเดิม) */}
      <nav className="md:hidden flex divide-x divide-black/30 border-t border-black/30">
        {/* ... (โค้ดส่วน Mobile ไม่เปลี่ยนแปลง) ... */}
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