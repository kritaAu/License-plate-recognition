import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./navbar";

const ROLE_OPTIONS = [
  { value: "นักศึกษา", label: "นักศึกษา" },
  { value: "อาจารย์", label: "อาจารย์" },
  { value: "บุคลากรในมหาลัย", label: "บุคลากรในมหาลัย" },
];

// กรองช่องหน้า: อนุญาตอักษรไทย + ตัวเลข ยาวสุด 6
const normalizePlatePrefix = (s) =>
  (s || "").replace(/[^\u0E00-\u0E7F0-9]/g, "").slice(0, 6);

// กรองช่องหลัง: อนุญาตเฉพาะตัวเลข ยาวสุด 4
const normalizeDigits = (s) => (s || "").replace(/\D/g, "").slice(0, 4);

export default function Register() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    student_id: "",
    first_name: "",
    last_name: "",
    faculty: "",
    major: "",
    role: ROLE_OPTIONS[0].value,

    // ⚠️ เปลี่ยนจาก plate เดิม → แยกเป็น 2 ช่อง + province
    platePrefix: "", // อักษร/ตัวเลขหน้า (เช่น กท หรือ 12)
    plateNumber: "", // ตัวเลขหลัง (เช่น 2058)
    province: "", // จังหวัด
    plate_note: "",
  });

  const [errors, setErrors] = useState({});

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const validate = () => {
    const err = {};
    if (!form.first_name.trim()) err.first_name = "กรอกชื่อ";
    if (!form.last_name.trim()) err.last_name = "กรอกนามสกุล";
    if (!form.student_id.trim()) err.student_id = "กรอกรหัสนักศึกษา/พนักงาน";

    if (!form.platePrefix.trim()) err.platePrefix = "กรอกตัวอักษร/ตัวเลขหน้า";
    if (!form.plateNumber.trim()) err.plateNumber = "กรอกตัวเลขหลัง";
    if (!form.province.trim()) err.province = "กรอกจังหวัด";

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  async function onSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    try {
      setBusy(true);

      const plate = `${form.platePrefix} ${form.plateNumber}`.trim();

      // ส่งข้อมูลไป backend
      const res = await fetch("http://localhost:8000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member: {
            firstname: form.first_name,
            lastname: form.last_name,
            std_id: form.student_id,
            faculty: form.faculty,
            major: form.major,
            role: form.role,
          },
          vehicle: {
            plate,
            province: form.province,
          },
        }),
      });

      if (!res.ok) throw new Error("บันทึกข้อมูลไม่สำเร็จ");
      const data = await res.json();

      alert("บันทึกข้อมูลเรียบร้อยแล้ว");
      console.log("Inserted:", data);

      // ไปหน้า Search หลังบันทึกสำเร็จ
      nav("/search");
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => nav(-1)}
            className="px-3 py-2 rounded bg-rose-100 text-rose-700 hover:bg-rose-200"
            title="ย้อนกลับ"
          >
            ←
          </button>
          <h1 className="text-2xl font-semibold text-gray-800">ลงทะเบียน</h1>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white rounded-lg shadow-sm p-4 sm:p-6"
        >
          {/* แถวที่ 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เลขทะเบียนนักศึกษา
              </label>
              <input
                name="student_id"
                value={form.student_id}
                onChange={onChange}
                className={`w-full px-3 py-2 border rounded-lg ${
                  errors.student_id ? "border-red-400" : "border-gray-300"
                }`}
                placeholder="เช่น 2310xxxxxxx"
              />
              {errors.student_id && (
                <p className="text-xs text-red-600 mt-1">{errors.student_id}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อ
              </label>
              <input
                name="first_name"
                value={form.first_name}
                onChange={onChange}
                className={`w-full px-3 py-2 border rounded-lg ${
                  errors.first_name ? "border-red-400" : "border-gray-300"
                }`}
              />
              {errors.first_name && (
                <p className="text-xs text-red-600 mt-1">{errors.first_name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                นามสกุล
              </label>
              <input
                name="last_name"
                value={form.last_name}
                onChange={onChange}
                className={`w-full px-3 py-2 border rounded-lg ${
                  errors.last_name ? "border-red-400" : "border-gray-300"
                }`}
              />
              {errors.last_name && (
                <p className="text-xs text-red-600 mt-1">{errors.last_name}</p>
              )}
            </div>
          </div>

          {/* แถวที่ 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                คณะ
              </label>
              <input
                name="faculty"
                value={form.faculty}
                onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                สาขา
              </label>
              <input
                name="major"
                value={form.major}
                onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ตำแหน่ง
              </label>
              <select
                name="role"
                value={form.role}
                onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* แถวที่ 3 — ป้ายทะเบียน */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ป้ายทะเบียนรถ
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* ช่องหน้า: อักษรไทย/ตัวเลข ได้สูงสุด 6 */}
                <input
                  name="platePrefix"
                  value={form.platePrefix}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      platePrefix: normalizePlatePrefix(e.target.value),
                    }))
                  }
                  className={`w-full px-3 py-2 border rounded-lg ${
                    errors.platePrefix ? "border-red-400" : "border-gray-300"
                  }`}
                  placeholder="เช่น กท หรือ 12"
                  inputMode="text"
                  aria-label="ตัวอักษร/ตัวเลขหน้า"
                  maxLength={10}
                />

                {/* ช่องหลัง: ตัวเลข สูงสุด 4 */}
                <input
                  name="plateNumber"
                  value={form.plateNumber}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      plateNumber: normalizeDigits(e.target.value),
                    }))
                  }
                  className={`w-full px-3 py-2 border rounded-lg ${
                    errors.plateNumber ? "border-red-400" : "border-gray-300"
                  }`}
                  placeholder="เช่น 2058"
                  inputMode="numeric"
                  aria-label="ตัวเลขหลัง"
                />

                {/* จังหวัด */}
                <input
                  name="province"
                  value={form.province}
                  onChange={onChange}
                  className={`w-full px-3 py-2 border rounded-lg ${
                    errors.province ? "border-red-400" : "border-gray-300"
                  }`}
                  placeholder="จังหวัด"
                  aria-label="จังหวัด"
                />
              </div>

              {(errors.platePrefix ||
                errors.plateNumber ||
                errors.province) && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.platePrefix || errors.plateNumber || errors.province}
                </p>
              )}
            </div>

            {/* กล่องตัวอย่างฟอร์แมต */}
            <div className="hidden md:flex items-center justify-center">
              <div className="w-48 h-44 rounded-xl bg-gray-100 text-gray-600 flex flex-col items-center justify-center text-lg">
                <div className="font-semibold tracking-wide">
                  {(form.platePrefix || "xx") +
                    " " +
                    (form.plateNumber || "xxxx")}
                </div>
                <div className="text-sm mt-1 text-gray-500">จังหวัด</div>
                <div className="mt-1">{form.province || "xxxx"}</div>
              </div>
            </div>
          </div>

          {/* ปุ่มบันทึก */}
          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-2 rounded-lg bg-green-200 text-gray-800 hover:bg-green-300 disabled:opacity-60"
            >
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
