import { Outlet } from "react-router-dom";
import Navbar from "./navbar";

export default function App() {
  return (
    <>
      <Navbar />
      <div style={{ padding: 20, marginTop: 56 }}>
        <Outlet />
      </div>
    </>
  );
}
