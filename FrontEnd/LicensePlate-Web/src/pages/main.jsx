// src/pages/main.jsx  (หรือ src/main.jsx ตามโปรเจกต์)
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "../css/index.css";
import App from "./App";
import Home from "./Home";
import Search from "./Search";
import Register from "./Register";
import Camera from "./Camera";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route element={<App />}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="register" element={<Register />} />
        <Route path="camera" element={<Camera />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);
