import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "../css/navbar.css";
import "../css/sidebar.css";


function Navbar({
  title = "ระบบตรวจจับรถจักรยานยนต์",
  cameraOn = true,
  onLogout,                // optional callback
  items = [
    { label: "Home", href: "#" },
    { label: "Search", href: "#" },
    { label: "อนุมัติการลงทะเบียน", href: "#" },
    { label: "กล้อง", href: "#", badge: true },
  ],
}) {
  const [isOpen, setIsOpen] = useState(false);
  const sidebarRef = useRef(null);

  // ปิดเมื่อกด ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ปิดเมื่อคลิกนอก sidebar
  useEffect(() => {
    const onClick = (e) => {
      if (!isOpen) return;
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [isOpen]);

  // ล็อกสกอลล์เมื่อเมนูเปิด (มือถือใช้งานง่ายขึ้น)
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => (document.body.style.overflow = prev);
    }
  }, [isOpen]);

  return (
    <>
      {/* Header Bar */}
      <header className="navbar-header">
        <button
          className="menu-btn"
          aria-label={isOpen ? "ปิดเมนูนำทาง" : "เปิดเมนูนำทาง"}
          aria-expanded={isOpen}
          aria-controls="sidebar-nav"
          onClick={() => setIsOpen((v) => !v)}
        >
          ☰
        </button>

        <span className="navbar-title">{title}</span>

        {/* กลุ่มปุ่มฝั่งขวา (ถ้ามี) */}
        <div className="navbar-actions">
          <span className={`camera-chip ${cameraOn ? "on" : "off"}`}>
            {cameraOn ? "ON" : "OFF"}
          </span>
          <button
            className="logout-btn"
            onClick={onLogout}
            type="button"
            title="Log out"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Backdrop */}
      <div
        className={`backdrop ${isOpen ? "show" : ""}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <nav id="sidebar-nav" className={`sidebar ${isOpen ? "open" : ""}`} aria-label="เมนูนำทางหลัก">
  <ul className="menu-list">
    {/* วาง 2 อันนี้แทนรายการเก่า */}
    <li>
      <NavLink to="/" className="menu-link" onClick={() => setIsOpen(false)}>
        Home
      </NavLink>
    </li>
    <li>
      <NavLink to="/search" className="menu-link" onClick={() => setIsOpen(false)}>
        Search
      </NavLink>
    </li>
    <li>
  <NavLink to="/register" className="menu-link" onClick={() => setIsOpen(false)}>
    ลงทะเบียน
  </NavLink>
</li>
<li className="menu-item-with-badge">
  <NavLink to="/camera" className="menu-link" onClick={() => setIsOpen(false)}>
    กล้อง
  </NavLink>
  <span className="badge on">ON</span> {/* ถ้าจะผูกกับสถานะจริงค่อยเปลี่ยนภายหลังก็ได้ */}
</li>
  </ul>
</nav>

    </>
  );
}

export default Navbar;
