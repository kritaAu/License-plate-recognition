// src/components/Filters.jsx
export default function Filters({
  filters,
  setFilters,
  onApply,
  onReset,
  onExport,
}) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((s) => ({
      ...s,
      [name]: value,
    }));
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between bg-blue-300">
      {/* ช่องฟิลเตอร์ด้านซ้าย */}
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-5">
        {/* วันที่เริ่ม */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">วันที่เริ่ม</label>
          <input
            type="date"
            name="start"
            value={filters.start || ""}
            onChange={handleChange}
            className="h-11 rounded-xl border border-sky-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </div>

        {/* วันที่สิ้นสุด */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            วันที่สิ้นสุด
          </label>
          <input
            type="date"
            name="end"
            value={filters.end || ""}
            onChange={handleChange}
            className="h-11 rounded-xl border border-sky-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </div>

        {/* สถานะรถ */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            สถานะรถ
          </label>
          <select
            name="direction" // ใช้ชื่อเดิมแต่ความหมายคือ status
            value={filters.direction || "all"}
            onChange={handleChange}
            className="h-11 rounded-xl border border-sky-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            <option value="all">ทั้งหมด</option>
            <option value="parked">กำลังจอด</option>
            <option value="completed">ออกแล้ว</option>
            <option value="unmatched">ไม่พบข้อมูลขาเข้า</option>
          </select>
        </div>

        {/* ประเภทบุคคล */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            ประเภทบุคคล
          </label>
          <select
            name="personType"
            value={filters.personType || "all"}
            onChange={handleChange}
            className="h-11 rounded-xl border border-sky-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            <option value="all">ทั้งหมด</option>
            <option value="inside">บุคคลภายใน</option>
            <option value="outside">บุคคลภายนอก</option>
          </select>
        </div>

        {/* ค้นหาทะเบียน */}
        <div className="flex flex-col gap-1 lg:col-span-1">
          <label className="text-xs font-medium text-slate-600">
            ค้นหาทะเบียน
          </label>
          <input
            type="text"
            name="query"
            placeholder="เช่น 6ษษ9272"
            value={filters.query || ""}
            onChange={handleChange}
            className="h-11 rounded-xl border border-sky-200 bg-white px-3 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </div>
      </div>

      {/* ปุ่มด้านขวา */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <button
          type="button"
          onClick={onApply}
          className="h-11 rounded-xl bg-sky-700 px-5 text-sm font-medium text-white shadow hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1"
        >
          ใช้ฟิลเตอร์
        </button>
        <button
          type="button"
          onClick={onReset}
          className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-1"
        >
          ล้างฟิลเตอร์
        </button>
        <button
          type="button"
          onClick={onExport}
          className="h-11 rounded-xl bg-emerald-500 px-5 text-sm font-medium text-white shadow hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}
