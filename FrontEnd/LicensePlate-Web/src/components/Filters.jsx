// src/components/Filters.jsx
export default function Filters({
  filters,
  setFilters,
  onApply,
  onReset,
  onExport,
}) {
  const onChange = (e) => {
    const { name, value } = e.target;
    setFilters((s) => ({ ...s, [name]: value }));
  };

  // แปลง yyyy-mm-dd → dd/mm/yyyy (โชว์ในบรรทัดสรุปด้านล่าง)
  const fmt = (iso) => {
    if (!iso) return "-";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="bg-[#c7d9e9] rounded-xl p-5">
      {/* แถวอินพุต 4 ช่อง */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div>
          <label className="block text-sm text-slate-800 mb-1">
            วันที่เริ่ม
          </label>
          <input
            type="date"
            name="start"
            value={filters.start}
            onChange={onChange}
            className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-800 mb-1">
            วันที่สิ้นสุด
          </label>
          <input
            type="date"
            name="end"
            value={filters.end}
            onChange={onChange}
            className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-800 mb-1">ทิศทาง</label>
          <select
            name="direction"
            value={filters.direction}
            onChange={onChange}
            className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
          >
            <option value="all">ทั้งหมด</option>
            <option value="in">เข้า (in)</option>
            <option value="out">ออก (out)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-800 mb-1">
            ค้นหาทะเบียน
          </label>
          <input
            name="query"
            placeholder="เช่น 6ขธ9272"
            value={filters.query}
            onChange={onChange}
            className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
          />
        </div>
      </div>

      {/* แถวปุ่ม: ไม่ยืดเต็ม กว้างเท่าในภาพแรก */}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          onClick={onApply}
          className="h-12 w-[220px] rounded-lg bg-[#1e64a3] text-white font-medium shadow-sm hover:brightness-110"
        >
          ใช้ฟิลเตอร์
        </button>

        <button
          onClick={onReset}
          className="h-12 w-[220px] rounded-lg bg-[#1a4f88] text-white/95 font-medium shadow-sm hover:brightness-110"
        >
          ล้างฟิลเตอร์
        </button>

        {/* ดันปุ่ม Export ไปขวาเหมือนภาพแรก */}
        <div className="ml-auto">
          <button
            onClick={onExport}
            className="rounded-full bg-rose-300 text-slate-900 px-6 py-2 font-semibold hover:bg-rose-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* สรุปช่วงวันที่ที่เลือก ใต้ฟิลเตอร์ */}
      <p className="mt-3 text-sm text-slate-700">
        ช่วงวันที่ที่เลือก:{" "}
        <span className="font-medium">{fmt(filters.start)}</span> –{" "}
        <span className="font-medium">{fmt(filters.end)}</span>
      </p>
    </div>
  );
}
