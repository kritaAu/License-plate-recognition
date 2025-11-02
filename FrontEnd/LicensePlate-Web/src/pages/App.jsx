import { Routes, Route } from "react-router-dom";
import Navbar from "./navbar";
import Home from "./Home";
import Camera from "./Camera";

export default function App() {
  return (
    <>
      <Navbar />
      <div style={{ padding: 20 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<h2>หน้าค้นหา</h2>} />
          <Route path="/approve" element={<h2>อนุมัติการลงทะเบียน</h2>} />
          <Route path="/camera" element={<Camera />} />
        </Routes>
      </div>
    </>
  );
}
