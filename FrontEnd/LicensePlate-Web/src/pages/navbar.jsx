import { useState } from "react";
import { NavLink } from "react-router-dom";
import "../css/navbar.css";


export default function Navbar({
  title = "ระบบตรวจจับรถจักรยานยนต์",
  cameraOn = true, // เพิ่ม Prop สำหรับสถานะกล้อง
  onLogout,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      {/* Top Header */}
      <header className="topnav">
        <div className="topnav-inner">
          {/* <<< LEFT AREA: ย้าย Links เข้ามาอยู่ใน Brand-wrap >>> */}
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
            
            {/* <<< LINKS ถูกย้ายมาอยู่ตรงนี้ เพื่อให้อยู่ติดกับ Brand >>> */}
            <nav className="nav-links" aria-label="เมนูนำทางหลัก">
              <NavLink to="/" className="nav-link" end>Home</NavLink>
              <NavLink to="/search" className="nav-link">Search</NavLink>
              <NavLink to="/register" className="nav-link">ลงทะเบียน</NavLink>
              <NavLink to="/camera" className="nav-link">กล้อง</NavLink>
            </nav>
          </div>
          {/* <<< Center Nav เดิมถูกลบออกไปเนื่องจาก Links ถูกย้ายไปแล้ว >>> */}
          
          {/* right: chips + logout */}
          <div className="top-actions">
            {/* เพิ่ม Camera Chip กลับเข้ามา */}
            <span className={`camera-chip ${cameraOn ? "on" : "off"}`}>
              {cameraOn ? "ON" : "OFF"}
            </span>
            <button className="logout-btn" onClick={onLogout}>Log out</button>
          </div>
        </div>
      </header>


      {/* Backdrop (ไม่เปลี่ยนแปลง) */}
      <div
        className={`backdrop ${menuOpen ? "show" : ""}`}
        onClick={closeMenu}
        aria-hidden="true"
      />
    </>
  );
}