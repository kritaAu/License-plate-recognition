import { useEffect, useMemo, useState } from "react";
import { getMembers, updateMember, deleteMember } from "../services/searchApi";

/* ------------ Modal แก้ไข ------------ */
function EditMemberModal({ open, onClose, member, onSave }) {
  const [form, setForm] = useState({
    plate: "",
    firstname: "",
    lastname: "",
    std_id: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      plate: member?.plate || "",
      firstname: member?.firstname || "",
      lastname: member?.lastname || "",
      // แคสต์เป็น string เพื่อใช้ใน input / toLowerCase
      std_id: String(member?.std_id ?? ""),
    });
  }, [open, member]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">แก้ไขข้อมูลสมาชิก</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm text-gray-600 mb-1">ทะเบียนรถ</label>
            <input
              name="plate"
              value={form.plate}
              onChange={onChange}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">ชื่อ</label>
              <input
                name="firstname"
                value={form.firstname}
                onChange={onChange}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">นามสกุล</label>
              <input
                name="lastname"
                value={form.lastname}
                onChange={onChange}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">รหัสนักศึกษา</label>
            <input
              name="std_id"
              value={form.std_id}
              onChange={onChange}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded border">
              ยกเลิก
            </button>
            <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white">
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------ หน้าหลัก Search ------------ */
export default function Search() {
  // ฟิลเตอร์ (กรองฝั่งหน้าเว็บ)
  const [filters, setFilters] = useState({
    plate: "",
    firstName: "",
    lastName: "",
    studentId: "",
  });

  // แสดงเฉพาะผู้ที่ลงทะเบียนแล้ว (มี plate) — เปิดไว้เป็นค่าเริ่มต้น
  const [registeredOnly, setRegisteredOnly] = useState(true);

  // ดาต้าทั้งหมดจาก backend
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // modal
  const [editing, setEditing] = useState(null);
  const [openEdit, setOpenEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await getMembers(); // <-- /members
      setAllRows(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    // 1) ถ้าเปิด registeredOnly ให้กรองเฉพาะรายการที่มี plate ก่อน
    const base = registeredOnly
      ? allRows.filter((r) => String(r.plate ?? "").trim() !== "")
      : allRows;

    // 2) กรองต่อด้วยฟิลเตอร์จากอินพุต
    const p = (filters.plate || "").trim().toLowerCase();
    const fn = (filters.firstName || "").trim().toLowerCase();
    const ln = (filters.lastName || "").trim().toLowerCase();
    const sid = (filters.studentId || "").trim().toLowerCase();

    return base.filter((r) => {
      const plate = String(r.plate ?? "").toLowerCase();
      const first = String(r.firstname ?? "").toLowerCase();
      const last  = String(r.lastname ?? "").toLowerCase();
      const stdId = String(r.std_id ?? "").toLowerCase();
      return (
        (!p   || plate.includes(p)) &&
        (!fn  || first.includes(fn)) &&
        (!ln  || last.includes(ln)) &&
        (!sid || stdId.includes(sid))
      );
    });
  }, [allRows, filters, registeredOnly]);

  const onFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((s) => ({ ...s, [name]: value }));
  };

  const handleOpenEdit = (row) => {
    setEditing(row);
    setOpenEdit(true);
  };

  const handleSaveEdit = async (form) => {
    if (!editing?.member_id) return;

    const stdIdForUpdate = /^\d+$/.test(form.std_id) ? Number(form.std_id) : form.std_id;

    await updateMember(editing.member_id, {
      firstname: form.firstname,
      lastname:  form.lastname,
      std_id:    stdIdForUpdate,
    });

    setAllRows((prev) =>
      prev.map((r) =>
        r.member_id === editing.member_id
          ? { ...r, firstname: form.firstname, lastname: form.lastname, std_id: stdIdForUpdate }
          : r
      )
    );
    setOpenEdit(false);
    setEditing(null);
  };

  const handleDelete = async (row) => {
    if (!row?.member_id) return;
    if (!confirm(`ลบข้อมูลของ "${row.plate}" ใช่หรือไม่?`)) return;

    try {
      await deleteMember(row.member_id);
      setAllRows((prev) => prev.filter((r) => r.member_id !== row.member_id));
    } catch (err) {
      alert(`ลบไม่สำเร็จ: ${err.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <h1 className="text-2xl font-semibold mb-4">Search</h1>

      {/* ฟิลเตอร์ */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="grid grid-cols-4 gap-4">
          <input
            name="plate"
            placeholder="ทะเบียนรถ"
            value={filters.plate}
            onChange={onFilterChange}
            className="border rounded px-3 py-2"
          />
          <input
            name="firstName"
            placeholder="ชื่อ"
            value={filters.firstName}
            onChange={onFilterChange}
            className="border rounded px-3 py-2"
          />
          <input
            name="lastName"
            placeholder="นามสกุล"
            value={filters.lastName}
            onChange={onFilterChange}
            className="border rounded px-3 py-2"
          />
          <input
            name="studentId"
            placeholder="รหัสนักศึกษา"
            value={filters.studentId}
            onChange={onFilterChange}
            className="border rounded px-3 py-2"
          />
        </div>

        {/* toggle registered only */}
        <div className="mt-3 flex items-center gap-2">
          <input
            id="registeredOnly"
            type="checkbox"
            checked={registeredOnly}
            onChange={(e) => setRegisteredOnly(e.target.checked)}
          />
          <label htmlFor="registeredOnly" className="text-sm text-gray-700">
            แสดงเฉพาะผู้ที่ลงทะเบียนแล้ว (มีทะเบียนรถ)
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <button onClick={load} className="w-full py-2 rounded bg-blue-100 text-blue-700">
            รีเซ็ท
          </button>
          <button
            onClick={() =>
              setFilters({ plate: "", firstName: "", lastName: "", studentId: "" })
            }
            className="w-full py-2 rounded bg-blue-100 text-blue-700"
          >
            ล้างฟิลเตอร์
          </button>
        </div>
      </div>

      {/* ตาราง */}
      <div className="bg-white rounded-lg shadow p-4">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-2">ทะเบียนรถ</th>
              <th className="text-left py-2 px-2">รหัสนักศึกษา</th>
              <th className="text-left py-2 px-2">ชื่อ-นามสกุล</th>
              <th className="text-left py-2 px-2 w-24">ลบ</th>
              <th className="text-left py-2 px-2 w-24">แก้ไข</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.member_id} className="border-b">
                <td className="py-2 px-2">{r.plate}</td>
                <td className="py-2 px-2">{r.std_id}</td>
                <td className="py-2 px-2">{`${r.firstname ?? ""} ${r.lastname ?? ""}`}</td>
                <td className="py-2 px-2">
                  <button
                    onClick={() => handleDelete(r)}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    🗑️ ลบ
                  </button>
                </td>
                <td className="py-2 px-2">
                  <button
                    onClick={() => handleOpenEdit(r)}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                  >
                    ✏️ แก้ไข
                  </button>
                </td>
              </tr>
            ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-gray-500">
                  ไม่พบข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {loading && (
          <div className="py-6 text-center text-sm text-gray-600">กำลังโหลด...</div>
        )}
      </div>

      <EditMemberModal
        open={openEdit}
        onClose={() => {
          setOpenEdit(false);
          setEditing(null);
        }}
        member={editing}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
