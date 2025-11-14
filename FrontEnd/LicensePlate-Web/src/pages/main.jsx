import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "../context/AuthContext";         
import AppLayout from "../components/AppLayout";                
import ProtectedRoute from "../components/ProtectedRoute";      

import Home from "./Home";
import Search from "./Search";
import Member from "./Member";
import Camera from "./Camera";
import Login from "./Login";

import "../css/index.css"; 

function AppRouter() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Login ไม่ต้องมี layout */}
          <Route path="/login" element={<Login />} />

          {/* ทุกหน้าปกติอยู่ใต้ AppLayout */}
          <Route element={<AppLayout />}>
            <Route
              index
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="search"
              element={
                <ProtectedRoute>
                  <Search />
                </ProtectedRoute>
              }
            />
            <Route
              path="member"
              element={
                <ProtectedRoute>
                  <Member />
                </ProtectedRoute>
              }
            />
            <Route
              path="camera"
              element={
                <ProtectedRoute>
                  <Camera />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<AppRouter />);
