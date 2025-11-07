import { useEffect, useMemo, useState } from "react";
import { getMembers, updateMember, deleteMember } from "../services/searchApi";

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
      std_id: String(member?.std_id ?? ""),
    });
  }, [open, member]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* ไล่เฉดน้ำเงิน */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-indigo-900/70 via-indigo-800/60 to-sky-900/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative mx-auto mt-20 w-full max-w-md px-4">
        <div className="rounded-2xl border border-sky-100 bg-white/95 p-6 shadow-[0_12px_28px_-12px_rgba(30,64,175,0.45)] backdrop-blur">
          <h3 className="mb-4 text-lg font-semibold tracking-tight text-indigo-900">
            แก้ไขข้อมูลสมาชิก
          </h3>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSave(form);
            }}
            className="space-y-4"
          >
            <div>
              <label className="mb-1 block text-sm text-slate-600">ทะเบียนรถ</label>
              <input
                name="plate"
                value={form.plate}
                onChange={onChange}
                className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-800
                           focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-600">ชื่อ</label>
                <input
                  name="firstname"
                  value={form.firstname}
                  onChange={onChange}
                  className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-800
                             focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">นามสกุล</label>
                <input
                  name="lastname"
                  value={form.lastname}
                  onChange={onChange}
                  className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-800
                             focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-600">รหัสนักศึกษา</label>
              <input
                name="std_id"
                value={form.std_id}
                onChange={onChange}
                className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-800
                           focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                required
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-2
                           font-medium text-white shadow hover:brightness-110"
              >
                บันทึก
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ------------ หน้าหลัก Search (โทนเดียวกับ Home) ------------ */
export default function Search() {
  const [filters, setFilters] = useState({
    plate: "",
    firstName: "",
    lastName: "",
    studentId: "",
  });

  const [registeredOnly, setRegisteredOnly] = useState(true);
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState(null);
  const [openEdit, setOpenEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await getMembers();
      setAllRows(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const base = registeredOnly
      ? allRows.filter((r) => String(r.plate ?? "").trim() !== "")
      : allRows;

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

  const handleOpenEdit = (row) => { setEditing(row); setOpenEdit(true); };

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
    <div className="relative min-h-screen">
      {/* พื้นหลังไล่เฉดให้เข้ากับหน้า Home */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-indigo-600 via-sky-200 to-white" />
      <div className="pointer-events-none absolute -top-20 -left-16 h-96 w-96 rounded-full bg-sky-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -right-12 h-[26rem] w-[26rem] rounded-full bg-indigo-400/30 blur-3xl" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* หัวข้อ */}
        <h1 className="mb-6 text-3xl font-bold tracking-tight text-white drop-shadow-sm">
          Search
        </h1>

        {/* การ์ดฟิลเตอร์ */}
        <section className="mb-6 rounded-2xl border border-sky-100 bg-white/90 p-6 shadow-[0_8px_24px_-10px_rgba(2,132,199,0.25)] backdrop-blur">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              name="plate"
              placeholder="ทะเบียนรถ"
              value={filters.plate}
              onChange={onFilterChange}
              className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-800
                         focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <input
              name="firstName"
              placeholder="ชื่อ"
              value={filters.firstName}
              onChange={onFilterChange}
              className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-800
                         focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <input
              name="lastName"
              placeholder="นามสกุล"
              value={filters.lastName}
              onChange={onFilterChange}
              className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-800
                         focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <input
              name="studentId"
              placeholder="รหัสนักศึกษา"
              value={filters.studentId}
              onChange={onFilterChange}
              className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-slate-800
                         focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                id="registeredOnly"
                type="checkbox"
                checked={registeredOnly}
                onChange={(e) => setRegisteredOnly(e.target.checked)}
                className="h-4 w-4 rounded accent-sky-600"
              />
              แสดงเฉพาะผู้ที่ลงทะเบียนแล้ว (มีทะเบียนรถ)
            </label>

            <div className="flex gap-3">
              <button
                onClick={load}
                className="rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-2 text-white shadow hover:brightness-110"
              >
                โหลดใหม่
              </button>
              <button
                onClick={() =>
                  setFilters({ plate: "", firstName: "", lastName: "", studentId: "" })
                }
                className="rounded-lg border border-sky-200 bg-white px-4 py-2 text-sky-700 hover:bg-sky-50"
              >
                ล้างฟิลเตอร์
              </button>
            </div>
          </div>
        </section>

        {/* ตารางผลลัพธ์ */}
        <section className="rounded-2xl border border-sky-100 bg-white/95 p-6 shadow-[0_8px_24px_-10px_rgba(30,64,175,0.25)] backdrop-blur">
          <div className="overflow-hidden rounded-xl ring-1 ring-sky-100">
            <table className="w-full text-left">
              <thead className="bg-sky-50/70 text-slate-700">
                <tr>
                  <th className="px-3 py-3">ทะเบียนรถ</th>
                  <th className="px-3 py-3">รหัสนักศึกษา</th>
                  <th className="px-3 py-3">ชื่อ-นามสกุล</th>
                  <th className="w-24 px-3 py-3">ลบ</th>
                  <th className="w-24 px-3 py-3">แก้ไข</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100">
                {rows.map((r) => (
                  <tr key={r.member_id} className="hover:bg-sky-50/60">
                    <td className="px-3 py-2">{r.plate}</td>
                    <td className="px-3 py-2">{r.std_id}</td>
                    <td className="px-3 py-2">{`${r.firstname ?? ""} ${r.lastname ?? ""}`}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleDelete(r)}
                        className="inline-flex items-center gap-1 rounded-md bg-red-100 px-3 py-1 text-red-700 hover:bg-red-200"
                      >
                        🗑️ ลบ
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleOpenEdit(r)}
                        className="inline-flex items-center gap-1 rounded-md bg-yellow-100 px-3 py-1 text-yellow-800 hover:bg-yellow-200"
                      >
                        ✏️ แก้ไข
                      </button>
                    </td>
                  </tr>
                ))}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {loading && (
            <div className="py-6 text-center text-sm text-slate-600">กำลังโหลด...</div>
          )}
        </section>
      </div>

      {/* Modal แก้ไข */}
      <EditMemberModal
        open={openEdit}
        onClose={() => { setOpenEdit(false); setEditing(null); }}
        member={editing}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
