// src/pages/Member.jsx
import { useEffect, useMemo, useState } from "react";
import {
  getMembers,
  updateMember,
  deleteMember,
  registerMemberWithVehicle,
} from "../services/searchApi";

/* ---------------- Utils เล็กๆ ---------------- */
const trimOrEmpty = (v) => (typeof v === "string" ? v.trim() : v);
const isDigits = (s) => /^\d+$/.test(String(s || ""));

/* ---------------- Modal: เพิ่ม/ลงทะเบียน ---------------- */
function AddMemberModal({ open, onClose, onSaved }) {
  const [member, setMember] = useState({
    std_id: "",
    firstname: "",
    lastname: "",
    faculty: "",
    major: "",
    role: "นักศึกษา",
  });

  // แยกช่องทะเบียน
  const [plateLetters, setPlateLetters] = useState("");
  const [plateNumbers, setPlateNumbers] = useState("");
  const [province, setProvince] = useState("");

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // reset ทุกครั้งที่เปิด
    setMember({
      std_id: "",
      firstname: "",
      lastname: "",
      faculty: "",
      major: "",
      role: "นักศึกษา",
    });
    setPlateLetters("");
    setPlateNumbers("");
    setProvince("");
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  const isLecturer = member.role === "อาจารย์";
  const isStaff = member.role === "เจ้าหน้าที่";
  const isStudent = !isLecturer && !isStaff;

  const plate = `${(plateLetters || "").trim()} ${(
    plateNumbers || ""
  ).trim()}`.trim();

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    // ตรวจข้อมูลพื้นฐาน
    if (!trimOrEmpty(member.firstname) || !trimOrEmpty(member.lastname)) {
      alert("กรอกชื่อ-นามสกุลให้ครบด้วยนะ");
      return;
    }
    if (!plate || !trimOrEmpty(province)) {
      alert("กรอกทะเบียนรถและจังหวัดให้ครบด้วยนะ");
      return;
    }
    if (plateNumbers && !/^\d+$/.test(plateNumbers)) {
      alert("เลขป้ายทะเบียนควรเป็นตัวเลข");
      return;
    }

    // เฉพาะนักศึกษา ต้องมี std_id และ major
    if (isStudent) {
      if (!String(member.std_id).trim()) {
        alert("กรอกรหัสนักศึกษาด้วยนะ");
        return;
      }
      if (!String(member.major).trim()) {
        alert("กรอกสาขาด้วยนะ");
        return;
      }
    }

    // -------- payload แบบ NESTED ตามที่แบ็กเอนด์คาด --------
    const memberPayload = {
      firstname: trimOrEmpty(member.firstname),
      lastname: trimOrEmpty(member.lastname),
      role: member.role,
      // นักศึกษา → ใส่ std_id/major และ faculty (ถ้ามี)
      ...(isStudent && {
        std_id: isDigits(member.std_id)
          ? Number(String(member.std_id).trim())
          : String(member.std_id).trim(),
        major: String(member.major).trim(),
        ...(member.faculty?.trim() ? { faculty: member.faculty.trim() } : {}),
      }),
      // อาจารย์ → ใส่ faculty ได้ (ไม่ต้อง std_id/major)
      ...(isLecturer &&
        (member.faculty?.trim() ? { faculty: member.faculty.trim() } : {})),
      // เจ้าหน้าที่ → ไม่ส่ง std_id/faculty/major
    };

    // ตัดคีย์ค่าว่าง/undefined ออก
    Object.keys(memberPayload).forEach((k) => {
      const v = memberPayload[k];
      if (v === "" || v == null) delete memberPayload[k];
    });

    const payload = {
      member: memberPayload,
      vehicle: {
        plate,
        province: province.trim(),
      },
    };
    // --------------------------------------------------------

    try {
      setSubmitting(true);
      await registerMemberWithVehicle(payload); // ส่งแบบ nested
      onSaved?.(); // reload ตารางหน้า Member
      onClose(); // ปิด modal
    } catch (err) {
      alert(err.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative mx-auto mt-10 w-full max-w-4xl p-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <h2 className="mb-4 text-2xl font-bold">ลงทะเบียนในระบบ</h2>

          <form onSubmit={submit} className="space-y-5">
            {/* แถว 1 */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* std_id เฉพาะนักศึกษา */}
              {isStudent && (
                <div>
                  <label className="mb-1 block text-sm text-gray-600">
                    เลขทะเบียนนักศึกษา
                  </label>
                  <input
                    className="w-full rounded-lg border px-3 py-2"
                    placeholder="เช่น 2310xxxxxx"
                    value={member.std_id}
                    onChange={(e) =>
                      setMember((s) => ({ ...s, std_id: e.target.value }))
                    }
                    required
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm text-gray-600">ชื่อ</label>
                <input
                  className="w-full rounded-lg border px-3 py-2"
                  value={member.firstname}
                  onChange={(e) =>
                    setMember((s) => ({ ...s, firstname: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">
                  นามสกุล
                </label>
                <input
                  className="w-full rounded-lg border px-3 py-2"
                  value={member.lastname}
                  onChange={(e) =>
                    setMember((s) => ({ ...s, lastname: e.target.value }))
                  }
                  required
                />
              </div>
            </div>

            {/* แถว 2 */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* คณะ: ซ่อนเมื่อเจ้าหน้าที่ */}
              {!isStaff && (
                <div>
                  <label className="mb-1 block text-sm text-gray-600">
                    คณะ
                  </label>
                  <input
                    className="w-full rounded-lg border px-3 py-2"
                    value={member.faculty}
                    onChange={(e) =>
                      setMember((s) => ({ ...s, faculty: e.target.value }))
                    }
                  />
                </div>
              )}
              {/* สาขา: เฉพาะนักศึกษา (required) */}
              {isStudent && (
                <div>
                  <label className="mb-1 block text-sm text-gray-600">
                    สาขา
                  </label>
                  <input
                    className="w-full rounded-lg border px-3 py-2"
                    value={member.major}
                    onChange={(e) =>
                      setMember((s) => ({ ...s, major: e.target.value }))
                    }
                    required
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm text-gray-600">
                  ตำแหน่ง
                </label>
                <select
                  className="w-full rounded-lg border bg-white px-3 py-2"
                  value={member.role}
                  onChange={(e) => {
                    const role = e.target.value;
                    setMember((s) => ({
                      ...s,
                      role,
                      // เปลี่ยนเป็น อาจารย์/เจ้าหน้าที่ -> ล้าง std_id/major
                      std_id:
                        role === "อาจารย์" || role === "เจ้าหน้าที่"
                          ? ""
                          : s.std_id,
                      major:
                        role === "อาจารย์" || role === "เจ้าหน้าที่"
                          ? ""
                          : s.major,
                      // เปลี่ยนเป็น เจ้าหน้าที่ -> ล้าง faculty ด้วย
                      faculty: role === "เจ้าหน้าที่" ? "" : s.faculty,
                    }));
                  }}
                >
                  <option>นักศึกษา</option>
                  <option>อาจารย์</option>
                  <option>เจ้าหน้าที่</option>
                </select>
              </div>
            </div>

            {/* ป้ายทะเบียนรถ */}
            <div>
              <label className="mb-2 block text-sm text-gray-600">
                ป้ายทะเบียนรถ
              </label>
              <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-4">
                <input
                  className="rounded-lg border px-3 py-2"
                  placeholder="เช่น กท / 12 (ไทย/ตัวเลข)"
                  value={plateLetters}
                  onChange={(e) => setPlateLetters(e.target.value)}
                />
                <input
                  className="rounded-lg border px-3 py-2"
                  placeholder="เช่น 2058 (ตัวเลข)"
                  value={plateNumbers}
                  onChange={(e) => setPlateNumbers(e.target.value)}
                />
                <input
                  className="rounded-lg border px-3 py-2"
                  placeholder="จังหวัด"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                />

                {/* preview */}
                <div className="rounded-xl border bg-gray-50 p-4 text-center text-sm">
                  <div className="font-semibold">
                    {plateLetters || "XX"} {plateNumbers || "0000"}
                  </div>
                  <div className="text-gray-500">{province || "จังหวัด"}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-rose-100 px-6 py-2 font-medium text-rose-700 hover:bg-rose-200"
                disabled={submitting}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-6 py-2 font-medium text-white hover:brightness-110 disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function EditMemberModal({ open, onClose, member, onSave }) {
  const [form, setForm] = useState({ firstname: "", lastname: "", std_id: "" });

  const isLecturer = member?.role === "อาจารย์";
  const isStaff = member?.role === "เจ้าหน้าที่";
  const isStudent = !isLecturer && !isStaff;

  useEffect(() => {
    if (!open) return;
    setForm({
      firstname: member?.firstname ?? "",
      lastname: member?.lastname ?? "",
      std_id: String(member?.std_id ?? ""),
    });
  }, [open, member]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      firstname: form.firstname.trim(),
      lastname: form.lastname.trim(),
      std_id: isStudent
        ? isDigits(form.std_id)
          ? Number(form.std_id)
          : form.std_id
        : form.std_id
        ? form.std_id
        : "",
    };
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative mx-auto mt-20 w-full max-w-md px-4">
        <form
          onSubmit={submit}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4"
        >
          <h3 className="text-lg font-semibold">แก้ไขข้อมูลสมาชิก</h3>

          <div>
            <label className="block text-sm text-slate-600 mb-1">ชื่อ</label>
            <input
              name="firstname"
              value={form.firstname}
              onChange={onChange}
              className="w-full rounded-lg border px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">นามสกุล</label>
            <input
              name="lastname"
              value={form.lastname}
              onChange={onChange}
              className="w-full rounded-lg border px-3 py-2"
              required
            />
          </div>

          {/* std_id เฉพาะนักศึกษา */}
          {isStudent && (
            <div>
              <label className="block text-sm text-slate-600 mb-1">
                รหัสนักศึกษา
              </label>
              <input
                name="std_id"
                value={form.std_id}
                onChange={onChange}
                className="w-full rounded-lg border px-3 py-2"
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 text-white px-4 py-2"
            >
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Member() {
  // ฟิลเตอร์ด้านบน
  const [filters, setFilters] = useState({
    plate: "",
    firstname: "",
    lastname: "",
  });

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // modal “+”
  const [openAdd, setOpenAdd] = useState(false);

  // modal “แก้ไข”
  const [editing, setEditing] = useState(null);
  const [openEdit, setOpenEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await getMembers(); // [{ member_id, std_id, firstname, lastname, plate, province, role, ...}]
      setRows(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // กรองหน้าเว็บ
  const filtered = useMemo(() => {
    const p = (filters.plate || "").toLowerCase().trim();
    const fn = (filters.firstname || "").toLowerCase().trim();
    const ln = (filters.lastname || "").toLowerCase().trim();
    return rows.filter((r) => {
      const plate = String(r.plate ?? "").toLowerCase();
      const first = String(r.firstname ?? "").toLowerCase();
      const last = String(r.lastname ?? "").toLowerCase();
      return (
        (!p || plate.includes(p)) &&
        (!fn || first.includes(fn)) &&
        (!ln || last.includes(ln))
      );
    });
  }, [rows, filters]);

  // เปิดโมดัลแก้ไข
  const handleOpenEdit = (row) => {
    setEditing(row);
    setOpenEdit(true);
  };

  // บันทึกแก้ไข
  const handleSaveEdit = async (payload) => {
    if (!editing?.member_id) return;
    try {
      await updateMember(editing.member_id, payload);
      // อัปเดตแถวในตารางทันที
      setRows((prev) =>
        prev.map((r) =>
          r.member_id === editing.member_id ? { ...r, ...payload } : r
        )
      );
      setOpenEdit(false);
      setEditing(null);
    } catch (err) {
      alert(`อัปเดตไม่สำเร็จ: ${err.message}`);
    }
  };

  // แสดง badge ตามตำแหน่ง
  const renderRole = (role) => {
    const r = (role || "").trim();
    const color =
      r === "นักศึกษา"
        ? "bg-blue-100 text-blue-800"
        : r === "อาจารย์"
        ? "bg-emerald-100 text-emerald-800"
        : r === "เจ้าหน้าที่"
        ? "bg-violet-100 text-violet-800"
        : "bg-slate-100 text-slate-700";
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
      >
        {r || "—"}
      </span>
    );
  };

  return (
    <div class="pt-0 bg-gradient-to-br from-white to-blue-400">
      <div className="mx-auto max-w-7xl px-4 py-6 ">
        <h1 className="mb-4 text-3xl font-bold">ค้นหาสมาชิก</h1>

        {/* แผงฟิลเตอร์ */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-[#c9d9e8] p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              className="rounded-lg border bg-white px-3 py-2"
              placeholder="ทะเบียนรถ"
              value={filters.plate}
              onChange={(e) =>
                setFilters((s) => ({ ...s, plate: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 mt-3">
            <input
              className="rounded-lg border bg-white px-3 py-2"
              placeholder="ชื่อ"
              value={filters.firstname}
              onChange={(e) =>
                setFilters((s) => ({ ...s, firstname: e.target.value }))
              }
            />
            <input
              className="rounded-lg border bg-white px-3 py-2"
              placeholder="นามสกุล"
              value={filters.lastname}
              onChange={(e) =>
                setFilters((s) => ({ ...s, lastname: e.target.value }))
              }
            />
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={load}
              className="rounded-lg bg-[#2a567b] px-6 py-2 font-medium text-white hover:brightness-110"
            >
              รีเฟรช
            </button>
            <button
              onClick={() =>
                setFilters({ plate: "", firstname: "", lastname: "" })
              }
              className="rounded-lg bg-white px-6 py-2 font-medium text-[#2a567b] ring-1 ring-[#2a567b]"
            >
              ล้างฟิลเตอร์
            </button>
          </div>
        </div>

        {/* ตาราง */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-3">ทะเบียนรถ</th>
                  <th className="px-3 py-3">รหัสนักศึกษา</th>
                  <th className="px-3 py-3">ชื่อ-นามสกุล</th>
                  <th className="px-3 py-3">ตำแหน่ง</th>
                  {/* เพิ่มคอลัมน์ */}
                  <th className="w-16 px-3 py-3">ลบ</th>
                  <th className="w-16 px-3 py-3">แก้ไข</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => (
                  <tr key={r.member_id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2">{r.plate}</td>
                    <td className="px-3 py-2">{r.std_id ?? "—"}</td>
                    <td className="px-3 py-2">{`${r.firstname ?? ""} ${
                      r.lastname ?? ""
                    }`}</td>
                    <td className="px-3 py-2">{renderRole(r.role)}</td>
                    {/* แสดง badge */}
                    <td className="px-3 py-2">
                      <button
                        onClick={async () => {
                          if (
                            !confirm(
                              `ลบ ${r.plate || r.firstname || "รายการนี้"} ?`
                            )
                          )
                            return;
                          await deleteMember(r.member_id);
                          load();
                        }}
                        className="rounded-md bg-rose-100 px-3 py-1 text-rose-700 hover:bg-rose-200"
                      >
                        ลบ
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleOpenEdit(r)}
                        className="rounded-md bg-yellow-100 px-3 py-1 text-yellow-800 hover:bg-yellow-200"
                      >
                        แก้ไข
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-slate-500"
                    >
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {loading && (
            <div className="py-6 text-center text-sm text-slate-600">
              กำลังโหลด...
            </div>
          )}
        </div>

        <button
          onClick={() => setOpenAdd(true)}
          className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:brightness-110"
          title="เพิ่มสมาชิก"
        >
          <span className="text-2xl leading-none">＋</span>
        </button>

        <AddMemberModal
          open={openAdd}
          onClose={() => setOpenAdd(false)}
          onSaved={load}
        />

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
    </div>
  );
}
