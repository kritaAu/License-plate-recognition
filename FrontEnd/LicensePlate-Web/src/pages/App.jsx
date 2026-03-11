import { Outlet } from "react-router-dom";
import Navbar from "./navbar";

export default function App() {
  return (
    <div className="min-h-screen bg-earth-950 text-earth-100 selection:bg-earth-600/30">
      <Navbar />
      
      <div className="pt-0">
        <Outlet />
      </div>
    </div>
  );
}
