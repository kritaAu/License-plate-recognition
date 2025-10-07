import { useState } from "react";
import "./navbar.css";


function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      {/* Header Bar */}
      <div className="navbar-header">
        <button className="menu-btn" onClick={() => setIsOpen(!isOpen)}>
          ☰
        </button>
        <span className="navbar-title">ระบบตรวจจับรถจักรยานยนต์</span>
      </div>

      {/* Sidebar */}
      <div className={`sidebar ${isOpen ? "open" : ""}`}>
        <ul>
          <li>Home</li>
          <li>Search</li>
          <li>อนุมัติการลงทะเบียน</li>
          <li>
            กล้อง <span className="badge">ON</span>
          </li>
          <hr />
          <li>Log out</li>
        </ul>
      </div>
    </div>
  );
}

export default Navbar;
