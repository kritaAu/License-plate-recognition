// src/pages/main.jsx  (หรือ src/main.jsx ตามโปรเจกต์)
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "../css/index.css";
import App from "./App";
import Home from "./Home";
import Search from "./Search";
import Member from "./Member";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route element={<App />}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="Member" element={<Member />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);
