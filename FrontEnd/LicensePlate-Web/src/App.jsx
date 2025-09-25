import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Navbar from "./navbar";

function App() {
  const [count, setCount] = useState(0)

  // mock data
  const stats = {
    total: 156,
    in: 97,
    out: 46,
    unknown: 13,
  };

  const records = [
    { time: "01/08/2025 13:06:03", plate: "234 ขนก กรุงเทพมหานคร", status: "เข้า", check: "บุคคลภายใน" },
    { time: "02/08/2025 12:06:03", plate: "87 ขข ขอนแก่น", status: "ออก", check: "บุคคลภายใน" },
    { time: "03/08/2025 11:06:03", plate: "98 กผ สมุทรสาคร", status: "เข้า", check: "บุคคลภายใน" },
    { time: "04/08/2025 10:06:03", plate: "123 กข นครราชสีมา", status: "เข้า", check: "บุคคลภายนอก" },
  ];

  return (
    <>
     <Navbar />  
    <div className="header">
      <a href="https://vite.dev" target="_blank">
        <img src={viteLogo} className="logo" alt="Vite logo" />
      </a>
      <a href="https://react.dev" target="_blank">
        <img src={reactLogo} className="logo react" alt="React logo" />
      </a>
    </div>

      <div className="header">
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>

      <h1>ระบบตรวจจับรถจักรยานยนต์</h1>

      {/* Stats */}
      <div className="stats">
        <div className="card">
          <p>ทั้งหมด</p>
          <h2 style={{ color: "black" }}>{stats.total}</h2> 
        </div>
        <div className="card">
          <p>เข้า (in)</p>
          <h2 style={{ color: "green" }}>{stats.in}</h2>
        </div>
        <div className="card">
          <p>ออก (out)</p>
          <h2 style={{ color: "blue" }}>{stats.out}</h2>
        </div>
        <div className="card">
          <p>ป้ายไม่รู้จัก</p>
          <h2 style={{ color: "red" }}>{stats.unknown}</h2>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <h2>รายการล่าสุด</h2>
        <table>
          <thead>
            <tr>
              <th>เวลา</th>
              <th>ทะเบียน</th>
              <th>สถานะ</th>
              <th>การตรวจสอบ</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={i}>
                <td>{r.time}</td>
                <td>{r.plate}</td>
                <td style={{ color: r.status === "เข้า" ? "green" : "blue" }}>{r.status}</td>
                <td style={{ color: r.check === "บุคคลภายใน" ? "green" : "red" }}>{r.check}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Counter ตัวอย่าง (ของเดิมจาก Vite Template) */}
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
    </>
  )
}

export default App
