import { Outlet } from "react-router-dom";
import Navbar from "./navbar";

export default function App() {
  return (
    <>
      <Navbar />
      <div style={{ padding: 0, marginTop: 0 }}>
        <Outlet />
      </div>
    </>
  );
}
