import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./navbar";
import Camera from "./Camera";
import Home from "./Home";

function App() {
  return (
    <Router>
      <Navbar />
      <div style={{ padding: "20px" }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<h2>หน้าค้นหา</h2>} />
          <Route path="/approve" element={<h2>อนุมัติการลงทะเบียน</h2>} />
          <Route path="/camera" element={<Camera />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
