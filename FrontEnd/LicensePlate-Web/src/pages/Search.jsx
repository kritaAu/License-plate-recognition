import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "./navbar";
import { searchMembers } from "../services/searchApi";

export default function Search() {
  const navigate = useNavigate();
  const location = useLocation();

  const [filters, setFilters] = useState({
    plate: "",
    firstName: "",
    lastName: "",
    studentId: "",
  });
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  // ใช้สำหรับ debounce เวลาเปลี่ยนฟิลเตอร์
  const debounceKey = useMemo(
    () =>
      `${filters.plate}|${filters.firstName}|${filters.lastName}|${filters.studentId}`,
    [filters]
  );

  const onChange = (e) => {
    const { name, value } = e.target;
    setFilters((p) => ({ ...p, [name]: value }));
  };

  const applyFilters = async () => {
    setBusy(true);
    try {
      const res = await searchMembers(filters, 1, 20);
      const list = Array.isArray(res) ? res : res?.data || [];

      // map ฟิลด์เป็นชื่อคอลัมน์ในตาราง
      const mapped = list.map((x) => ({
        plate: x.plate || "-",
        studentId: x.student_id || x.studentId || "-",
        fullName:
          x.full_name || `${x.first_name || ""} ${x.last_name || ""}`.trim(),
        _raw: x,
      }));

      setRows(mapped);
      // อัปเดต cache ให้ตรงกับผลค้นหา (ถ้าอยากให้ cache เก็บเฉพาะ newRow ให้คอมเมนต์บรรทัดนี้)
      localStorage.setItem("search_cache", JSON.stringify(mapped));
    } finally {
      setBusy(false);
    }
  };

  const resetFilters = () => {
    setFilters({ plate: "", firstName: "", lastName: "", studentId: "" });
    setRows([]);
    // ล้าง cache ด้วย (เพื่อความชัดเจน)
    localStorage.removeItem("search_cache");
  };

  // โหลด cache ครั้งแรก (กันรีเฟรชแล้วหาย)
  useEffect(() => {
    const cache = JSON.parse(localStorage.getItem("search_cache") || "[]");
    if (Array.isArray(cache) && cache.length) setRows(cache);
  }, []);

  // รับ newRow จากหน้า Register แล้ว prepend + เก็บ cache + ล้าง state ออกจาก history
  useEffect(() => {
    const newRow = location.state?.newRow;
    if (!newRow) return;

    setRows((prev) => {
      // กันซ้ำแบบง่าย ๆ: ตรวจซ้ำด้วย plate+studentId
      const exists = prev.some(
        (r) => r.plate === newRow.plate && r.studentId === newRow.studentId
      );
      const next = exists ? prev : [newRow, ...prev];
      localStorage.setItem("search_cache", JSON.stringify(next));
      return next;
    });

    // ล้าง state ออกจาก URL history กันเติมซ้ำเมื่อย้อนหรือรีเฟรช
    navigate(location.pathname, { replace: true });
  }, [location.state, location.pathname, navigate]);

  // ค้นหาอัตโนมัติแบบ debounce เมื่อพิมพ์ >= 3 ตัวอักษรในอย่างน้อย 1 ช่อง
  useEffect(() => {
    const ok = [filters.plate, filters.firstName, filters.lastName, filters.studentId]
      .some((v) => (v || "").trim().length >= 3);

    if (!ok) return;
    const t = setTimeout(() => { applyFilters(); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounceKey]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Title */}
        <div className="flex items-center gap-3 mb-4">
          <button
            className="px-3 py-2 rounded bg-gray-200 text-gray-700"
            onClick={() => history.back()}
          >
            ←
          </button>
          <h1 className="text-2xl font-semibold text-gray-800">Search</h1>
        </div>

        {/* Filters box */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              className="px-3 py-2 rounded border border-gray-300"
              placeholder="เลขทะเบียนรถ"
              name="plate"
              value={filters.plate}
              onChange={onChange}
            />
            <input
              className="px-3 py-2 rounded border border-gray-300"
              placeholder="ชื่อ"
              name="firstName"
              value={filters.firstName}
              onChange={onChange}
            />
            <input
              className="px-3 py-2 rounded border border-gray-300"
              placeholder="นามสกุล"
              name="lastName"
              value={filters.lastName}
              onChange={onChange}
            />
            <input
              className="px-3 py-2 rounded border border-gray-300"
              placeholder="เลขทะเบียนนักศึกษา"
              name="studentId"
              value={filters.studentId}
              onChange={onChange}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <button
              onClick={applyFilters}
              className="w-full py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium disabled:opacity-60"
              disabled={busy}
            >
              ใช้ฟิลเตอร์
            </button>
            <button
              onClick={resetFilters}
              className="w-full py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium"
            >
              ล้างฟิลเตอร์
            </button>
          </div>
        </div>

        {/* Result table */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="text-left px-4 py-3 border">ทะเบียนรถ</th>
                  <th className="text-left px-4 py-3 border">รหัสนักศึกษา</th>
                  <th className="text-left px-4 py-3 border">ชื่อ-นามสกุล</th>
                  <th className="text-center px-4 py-3 border w-24">ลบ</th>
                  <th className="text-center px-4 py-3 border w-24">แก้ไข</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.plate}-${r.studentId}-${i}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 border">{r.plate}</td>
                    <td className="px-4 py-3 border">{r.studentId}</td>
                    <td className="px-4 py-3 border">{r.fullName}</td>
                    <td className="px-4 py-3 border text-center">
                      <button
                        className="inline-flex items-center justify-center w-9 h-9 rounded bg-red-50 hover:bg-red-100"
                        title="ลบ"
                        onClick={() => alert("TODO: delete")}
                      >
                        🗑️
                      </button>
                    </td>
                    <td className="px-4 py-3 border text-center">
                      <button
                        className="inline-flex items-center justify-center w-9 h-9 rounded bg-yellow-50 hover:bg-yellow-100"
                        title="แก้ไข"
                        onClick={() => alert("TODO: edit")}
                      >
                        ✏️
                      </button>
                    </td>
                  </tr>
                ))}

                {!rows.length && (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                      ไม่มีผลลัพธ์
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAB เพิ่มรายการ/ไปลงทะเบียน */}
        <button
          type="button"
          aria-label="ไปหน้าลงทะเบียน"
          title="ไปหน้าลงทะเบียน"
          onClick={() => navigate("/register")}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-blue-600 text-white text-2xl shadow-lg hover:bg-blue-700 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          +
        </button>
      </div>
    </div>
  );
}
