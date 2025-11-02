import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "../css/index.css";          
import App from "./App";            
import Search from "./Search";
import Register from "./Register";
import Camera from "./Camera";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/search" element={<Search />} />
      <Route path="/register" element={<Register />} />
      <Route path="/camera" element={<Camera />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      <Route path="/*" element={<App />} />  
    </Routes>
  </BrowserRouter>
);
