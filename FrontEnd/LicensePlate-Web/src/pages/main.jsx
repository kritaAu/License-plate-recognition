import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "../css/index.css";
import App from "./App";
import Home from "./Home";
import Search from "./Search";
import Member from "./Member";
import LoginPage from "./Login";

// Auth Service
const AuthService = {
  getToken: () => localStorage.getItem("auth_token"),
  isAuthenticated: () => !!AuthService.getToken(),
};

// Protected Route Component (inline)
function ProtectedRoute({ children }) {
  if (!AuthService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      {/* Login Route - เข้าถึงได้โดยไม่ต้อง login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Routes - ต้อง login ก่อน */}
      <Route element={<App />}>
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
      </Route>

      {/* Redirect ทุกอย่างที่ไม่รู้จักไปที่ login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </BrowserRouter>
);
