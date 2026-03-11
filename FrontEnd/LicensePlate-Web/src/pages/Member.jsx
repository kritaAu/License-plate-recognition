import { useEffect, useMemo, useState } from "react";
import {
  fetchMembers,
  updateMember,
  deleteMember,
  registerMemberWithVehicle,
} from "../services/api";

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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto mt-10 w-full max-w-4xl p-4">
        <div className="rounded-2xl border border-earth-700 bg-earth-900 p-8 shadow-2xl text-earth-100">
          <h2 className="mb-6 text-2xl font-bold flex items-center gap-3">
            <span className="w-2 h-8 rounded-full bg-earth-400 shadow-[0_0_12px_rgba(163,177,138,0.8)]"></span>
            ลงทะเบียนในระบบ
          </h2>

          <form onSubmit={submit} className="space-y-6">
            {/* แถว 1 */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* std_id เฉพาะนักศึกษา */}
              {isStudent && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-earth-300">
                    เลขทะเบียนนักศึกษา
                  </label>
                  <input
                    className="w-full rounded-xl border border-earth-700 bg-earth-950 px-3 py-2.5 text-sm text-earth-200 shadow-inner focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50 placeholder:text-earth-600"
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
                <label className="mb-1.5 block text-sm font-medium text-earth-300">ชื่อ</label>
                <input
                  className="w-full rounded-xl border border-earth-700 bg-earth-950 px-3 py-2.5 text-sm text-earth-200 shadow-inner focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50 placeholder:text-earth-600"
                  value={member.firstname}
                  onChange={(e) =>
                    setMember((s) => ({ ...s, firstname: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-earth-300">
                  นามสกุล
                </label>
                <input
                  className="w-full rounded-xl border border-earth-700 bg-earth-950 px-3 py-2.5 text-sm text-earth-200 shadow-inner focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50 placeholder:text-earth-600"
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
                  <label className="mb-1.5 block text-sm font-medium text-earth-300">
                    คณะ
                  </label>
                  <input
                    className="w-full rounded-xl border border-earth-700 bg-earth-950 px-3 py-2.5 text-sm text-earth-200 shadow-inner focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50 placeholder:text-earth-600"
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
                  <label className="mb-1.5 block text-sm font-medium text-earth-300">
                    สาขา
                  </label>
                  <input
                    className="w-full rounded-xl border border-earth-700 bg-earth-950 px-3 py-2.5 text-sm text-earth-200 shadow-inner focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50 placeholder:text-earth-600"
                    value={member.major}
                    onChange={(e) =>
                      setMember((s) => ({ ...s, major: e.target.value }))
                    }
                    required
                  />
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-earth-300">
                  ตำแหน่ง
                </label>
                <select
                  className="w-full rounded-xl border border-earth-700 bg-earth-950 px-3 py-2.5 text-sm text-earth-200 shadow-inner focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50"
                  value={member.role}
                  onChange={(e) => {
                    const role = e.target.value;
                    setMember((s) => ({
                      ...s,
                      role,
                      std_id:
                        role === "อาจารย์" || role === "เจ้าหน้าที่"
                          ? ""
                          : s.std_id,
                      major:
                        role === "อาจารย์" || role === "เจ้าหน้าที่"
                          ? ""
                          : s.major,
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
              <label className="mb-2 block text-sm font-medium text-earth-300">
                ป้ายทะเบียนรถ
              </label>
              <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-4">
                <input
                  className="rounded-xl border border-earth-700 bg-earth-950 px-3 py-2.5 text-sm text-earth-200 shadow-inner focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50 placeholder:text-earth-600"
                  placeholder="เช่น กท / 12 (ตัวอักษร)"
                  value={plateLetters}
                  onChange={(e) => setPlateLetters(e.target.value)}
                />
                <input
                  className="rounded-xl border border-earth-700 bg-earth-950 px-3 py-2.5 text-sm text-earth-200 shadow-inner focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50 placeholder:text-earth-600"
                  placeholder="เช่น 2058 (ตัวเลข)"
                  value={plateNumbers}
                  onChange={(e) => setPlateNumbers(e.target.value)}
                />
                <input
                  className="rounded-xl border border-earth-700 bg-earth-950 px-3 py-2.5 text-sm text-earth-200 shadow-inner focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50 placeholder:text-earth-600"
                  placeholder="จังหวัด"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                />

                {/* preview */}
                <div className="rounded-xl border border-earth-700 bg-earth-950 p-4 text-center text-sm shadow-inner flex flex-col justify-center items-center gap-1">
                  <div className="inline-flex items-center rounded-lg border border-earth-600 bg-earth-900 px-4 py-2 text-base font-semibold tracking-wide text-earth-100 shadow-inner min-w-[120px] justify-center">
                    {plateLetters || "XX"} {plateNumbers || "0000"}
                  </div>
                  <div className="text-earth-400 text-[11px] mt-1">{province || "จังหวัด"}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-earth-800">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-xl border border-earth-700 bg-earth-800 px-6 font-medium text-earth-300 shadow-sm hover:bg-earth-700 transition-colors"
                disabled={submitting}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="h-11 rounded-xl bg-earth-600 px-6 font-bold text-white shadow-[0_0_12px_rgba(88,129,87,0.4)] hover:bg-earth-500 hover:shadow-[0_0_16px_rgba(88,129,87,0.6)] transition-all disabled:opacity-60"
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto mt-20 w-full max-w-md px-4">
        <form
          onSubmit={submit}
          className="rounded-2xl border border-earth-700 bg-earth-900 p-8 shadow-2xl text-earth-100 space-y-5"
        >
          <h3 className="text-xl font-bold flex items-center gap-3 mb-2">
            <span className="w-1.5 h-6 rounded-full bg-earth-400 shadow-[0_0_12px_rgba(163,177,138,0.8)]"></span>
            แก้ไขข้อมูลสมาชิก
          </h3>

          <div>
            <label className="block text-sm font-medium text-earth-300 mb-1.5">ชื่อ</label>
            <input
              name="firstname"
              value={form.firstname}
              onChange={onChange}
              className="w-full rounded-xl border border-earth-700 bg-earth-950 px-3 py-2.5 text-sm text-earth-200 shadow-inner focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-earth-300 mb-1.5">นามสกุล</label>
            <input
              name="lastname"
              value={form.lastname}
              onChange={onChange}
              className="w-full rounded-xl border border-earth-700 bg-earth-950 px-3 py-2.5 text-sm text-earth-200 shadow-inner focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50"
              required
            />
          </div>

          {/* std_id เฉพาะนักศึกษา */}
          {isStudent && (
            <div>
              <label className="block text-sm font-medium text-earth-300 mb-1.5">
                รหัสนักศึกษา
              </label>
              <input
                name="std_id"
                value={form.std_id}
                onChange={onChange}
                className="w-full rounded-xl border border-earth-700 bg-earth-950 px-3 py-2.5 text-sm text-earth-200 shadow-inner focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50"
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-earth-800">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-earth-700 bg-earth-800 px-6 font-medium text-earth-300 shadow-sm hover:bg-earth-700 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="h-11 rounded-xl bg-earth-600 px-6 font-bold text-white shadow-[0_0_12px_rgba(88,129,87,0.4)] hover:bg-earth-500 transition-all"
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
      const list = await fetchMembers();
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
        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
        : r === "อาจารย์"
        ? "bg-earth-500/10 text-earth-400 border-earth-500/20"
        : r === "เจ้าหน้าที่"
        ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
        : "bg-earth-700/50 text-earth-300 border-earth-600/50";
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${color}`}
      >
        {r || "—"}
      </span>
    );
  };

  return (
    <div className="pt-0">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="mb-4 text-3xl font-bold text-white flex items-center gap-3">
          <span className="w-2 h-8 rounded-full bg-earth-400 shadow-[0_0_12px_rgba(163,177,138,0.8)]"></span>
          ค้นหาสมาชิก
        </h1>

        {/* แผงฟิลเตอร์ */}
        <div className="mb-6 rounded-2xl bg-earth-900/50 p-6 shadow-sm border border-earth-800 backdrop-blur-xl">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <input
              className="h-11 rounded-xl border border-earth-700 bg-earth-800 px-3 text-sm text-earth-300 shadow-inner placeholder:text-earth-500 focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50"
              placeholder="ทะเบียนรถ"
              value={filters.plate}
              onChange={(e) =>
                setFilters((s) => ({ ...s, plate: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mt-4">
            <input
              className="h-11 rounded-xl border border-earth-700 bg-earth-800 px-3 text-sm text-earth-300 shadow-inner placeholder:text-earth-500 focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50"
              placeholder="ชื่อ"
              value={filters.firstname}
              onChange={(e) =>
                setFilters((s) => ({ ...s, firstname: e.target.value }))
              }
            />
            <input
              className="h-11 rounded-xl border border-earth-700 bg-earth-800 px-3 text-sm text-earth-300 shadow-inner placeholder:text-earth-500 focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50"
              placeholder="นามสกุล"
              value={filters.lastname}
              onChange={(e) =>
                setFilters((s) => ({ ...s, lastname: e.target.value }))
              }
            />
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={load}
              className="h-11 rounded-xl bg-earth-600 px-6 font-bold text-white shadow-[0_0_12px_rgba(88,129,87,0.4)] hover:bg-earth-500 hover:shadow-[0_0_16px_rgba(88,129,87,0.6)] focus:outline-none focus:ring-2 focus:ring-earth-400 focus:ring-offset-2 focus:ring-offset-earth-900 transition-all"
            >
              รีเฟรช
            </button>
            <button
              onClick={() =>
                setFilters({ plate: "", firstname: "", lastname: "" })
              }
              className="h-11 rounded-xl border border-earth-700 bg-earth-800 px-6 font-medium text-earth-300 shadow-sm hover:bg-earth-700 focus:outline-none focus:ring-2 focus:ring-earth-500 focus:ring-offset-2 focus:ring-offset-earth-900 transition-all"
            >
              ล้างฟิลเตอร์
            </button>
          </div>
        </div>

        {/* ตาราง */}
        <section className="rounded-2xl bg-earth-900/60 p-6 shadow-2xl border border-earth-800/80 backdrop-blur-xl">
          <div className="overflow-hidden rounded-xl border border-earth-700/50 bg-earth-950/50 text-sm">
            <table className="w-full text-left divide-y divide-earth-800/50">
              <thead className="bg-earth-900/80 backdrop-blur-md">
                <tr>
                  <th className="px-4 py-3 font-semibold text-earth-300 whitespace-nowrap">ทะเบียนรถ</th>
                  <th className="px-4 py-3 font-semibold text-earth-300 whitespace-nowrap">รหัสนักศึกษา</th>
                  <th className="px-4 py-3 font-semibold text-earth-300 whitespace-nowrap">ชื่อ-นามสกุล</th>
                  <th className="px-4 py-3 font-semibold text-earth-300 whitespace-nowrap">ตำแหน่ง</th>
                  {/* เพิ่มคอลัมน์ */}
                  <th className="w-16 px-4 py-3 font-semibold text-earth-300 whitespace-nowrap">ลบ</th>
                  <th className="w-16 px-4 py-3 font-semibold text-earth-300 whitespace-nowrap">แก้ไข</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-earth-800/50">
                {filtered.map((r) => (
                  <tr key={r.member_id} className="hover:bg-earth-800/40 transition-colors">
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1 w-min">
                        <span className="inline-flex items-center rounded-xl border border-earth-700 bg-earth-900 px-4 py-2 text-base font-semibold tracking-wide text-earth-100 shadow-inner min-w-[120px] justify-center whitespace-nowrap">{r.plate || "—"}</span>
                        <span className="text-xs text-earth-400 text-center mt-1">
                          {r.province || "ไม่ทราบจังหวัด"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-4 align-top text-earth-200">{r.std_id ?? "—"}</td>
                    <td className="px-4 py-4 align-top text-earth-200">{`${r.firstname ?? ""} ${
                      r.lastname ?? ""
                    }`}</td>
                    <td className="px-4 py-4 align-top">{renderRole(r.role)}</td>

                    {/* แสดง badge */}
                    <td className="px-4 py-4 align-top">
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
                        className="rounded-md bg-rose-500/10 px-3 py-1 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                      >
                        ลบ
                      </button>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <button
                        onClick={() => handleOpenEdit(r)}
                        className="rounded-md bg-amber-500/10 px-3 py-1 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-colors"
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
                      className="px-4 py-8 text-center text-earth-400"
                    >
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {loading && (
            <div className="py-6 text-center text-sm text-earth-500">
              กำลังโหลด...
            </div>
          )}
        </section>

        <button
          onClick={() => setOpenAdd(true)}
          className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-earth-600 text-white shadow-[0_0_15px_rgba(88,129,87,0.5)] hover:bg-earth-500 transition-all font-bold"
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
