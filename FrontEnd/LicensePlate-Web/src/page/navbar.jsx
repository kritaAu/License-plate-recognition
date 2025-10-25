import { useState } from "react";
import { Link } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

function navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav
      className="navbar navbar-expand-lg fixed-top navbar-dark bg-dark"
      aria-label="Main navigation"
    >
      <div className="container-fluid">
        {/* ชื่อระบบ */}
        <span className="navbar-brand">ระบบตรวจจับรถจักรยานยนต์</span>

        {/* ปุ่มแฮมเบอร์เกอร์ (มือถือ) */}
        <button
          className="navbar-toggler p-0 border-0"
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* เมนูหลัก */}
        <div
          className={`navbar-collapse offcanvas-collapse ${
            isOpen ? "open" : ""
          }`}
          id="navbarsExampleDefault"
        >
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <Link className="nav-link active" to="/">
                หน้าแรก
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/search">
                ค้นหา
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/approve">
                อนุมัติการลงทะเบียน
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/camera">
                กล้อง
              </Link>
            </li>
          </ul>

          <button className="btn btn-outline-danger" type="button">
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}

export default navbar;
