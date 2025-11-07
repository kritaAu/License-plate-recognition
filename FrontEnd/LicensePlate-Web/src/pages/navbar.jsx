import { useState } from "react";
import { NavLink } from "react-router-dom";
import "../css/navbar.css";


export default function Navbar({
  title = "ระบบตรวจจับรถจักรยานยนต์",
  cameraOn = true,
  onLogout,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      {/* Top Header */}
      <header className="topnav">
        <div className="topnav-inner">
          {/* left: brand + mobile toggle */}
          <div className="brand-wrap">
            <button
              className="mobile-toggle"
              aria-label={menuOpen ? "ปิดเมนู" : "เปิดเมนู"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              ☰
            </button>
            <span className="brand ">{title}</span>
          </div>

          {/* center: links (desktop) */}
          <nav className="nav-links" aria-label="เมนูนำทางหลัก">
            <NavLink to="/" className="nav-link" end>Home</NavLink>
            <NavLink to="/search" className="nav-link">Search</NavLink>
            <NavLink to="/register" className="nav-link">ลงทะเบียน</NavLink>
            <NavLink to="/camera" className="nav-link">กล้อง</NavLink>
          </nav>

          {/* right: chips + logout */}
          <div className="top-actions">
            <span className={`camera-chip ${cameraOn ? "on" : "off"}`}>
              {cameraOn ? "ON" : "OFF"}
            </span>
            <button className="logout-btn bg-white" onClick={onLogout}>Log out</button>
          </div>
        </div>
      </header>

      {/* Mobile panel */}
      <div className={`mobile-panel ${menuOpen ? "open" : ""}`} role="dialog" aria-modal="true">
        <nav className="mobile-menu" onClick={closeMenu}>
          <NavLink to="/" className="mobile-link" end>Home</NavLink>
          <NavLink to="/search" className="mobile-link">Search</NavLink>
          <NavLink to="/register" className="mobile-link">ลงทะเบียน</NavLink>
          <NavLink to="/camera" className="mobile-link">กล้อง</NavLink>
        </nav>
      </div>

      {/* Backdrop */}
      <div
        className={`backdrop ${menuOpen ? "show" : ""}`}
        onClick={closeMenu}
        aria-hidden="true"
      />
    </>
  );
}
