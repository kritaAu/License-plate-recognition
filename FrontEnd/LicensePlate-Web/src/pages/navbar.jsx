import { NavLink, useNavigate } from "react-router-dom";

const AuthService = {
  // Mock implementations (ใช้ LocalStorage เดิม)
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
  { to: "/", label: "Dashboard" }, // เปลี่ยนชื่อ Home เป็น Dashboard เพื่อความชัดเจน
  { to: "/search", label: "ค้นหา" },
  { to: "/member", label: "สมาชิก" },
];

export default function Navbar() {
  const navigate = useNavigate();
  const user = AuthService.getUser();

  const handleLogout = () => {
    AuthService.logout();
    navigate("/login");
  };

  const desktopNavLinkClass = ({ isActive }) =>
    [
      "relative h-full flex items-center px-4 font-medium transition-colors duration-200",
      "text-white/80 hover:text-white",
      isActive
        ? "text-white after:absolute after:bottom-0 after:left-0 after:h-[3px] after:w-full after:bg-sky-400 after:shadow-[0_0_10px_#38bdf8]"
        : "",
    ].join(" ");

  const mobileNavLinkClass = ({ isActive }) =>
    [
      "flex-1 text-center py-2 text-sm font-medium transition-colors",
      isActive
        ? "bg-sky-600 text-white shadow-inner shadow-black/20"
        : "text-white hover:bg-white/10",
    ].join(" ");

  return (
    <header className="w-full bg-[#0c2a52] text-white shadow-xl sticky top-0 z-50">
      {/* Desktop Navbar */}
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
        <div className="flex h-16 items-stretch justify-between">
          {/* ส่วนซ้าย: Brand + Links */}
          <div className="flex items-stretch">
            {/* Brand */}
            <div className="flex items-center">
              <span className="text-xl sm:text-2xl font-extrabold tracking-wider text-sky-400">
                LPR Admin
              </span>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden h-full md:flex items-stretch ml-8">
              {TABS.map((t) => (
                <NavLink key={t.to} to={t.to} className={desktopNavLinkClass}>
                  {t.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* ส่วนขวา: User Info + Logout */}
          <div className="flex items-center gap-4">
            {/* แสดงชื่อ User */}
            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-sky-500/50">
                <span className="text-sm font-medium">👤 {user.username}</span>
                <span className="text-xs opacity-75">
                  ({user.role === "admin" ? "ผู้ดูแล" : "พนักงาน"})
                </span>
              </div>
            )}

            {/* ปุ่ม Logout */}
            <button
              onClick={handleLogout}
              className="rounded-full bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-semibold shadow-md shadow-black/30 transition-colors"
              title="ออกจากระบบ"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navbar */}
      <nav className="md:hidden flex divide-x divide-white/20 border-t border-black/30">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className={mobileNavLinkClass}>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
