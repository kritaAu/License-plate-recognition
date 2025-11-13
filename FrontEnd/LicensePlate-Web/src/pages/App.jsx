import { Outlet } from "react-router-dom";
import Navbar from "./navbar";

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-tr from-white to-blue-200">
      <Navbar />
      
      <div className="pt-0">
        <Outlet />
      </div>
    </div>
  );
}
