import { Outlet } from "react-router-dom";
import Navbar from "../pages/navbar"; 

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-tr from-white to-blue-400">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
