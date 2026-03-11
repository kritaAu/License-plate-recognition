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
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between bg-transparent">
      {/* ช่องฟิลเตอร์ด้านซ้าย */}
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-5">
        {/* วันที่เริ่ม */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-earth-400">วันที่เริ่ม</label>
          <input
            type="date"
            name="start"
            value={filters.start || ""}
            onChange={handleChange}
            className="h-11 rounded-xl border border-earth-700 bg-earth-800 px-3 text-sm text-earth-300 shadow-inner focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50 [color-scheme:dark]"
          />
        </div>

        {/* วันที่สิ้นสุด */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-earth-400">
            วันที่สิ้นสุด
          </label>
          <input
            type="date"
            name="end"
            value={filters.end || ""}
            onChange={handleChange}
            className="h-11 rounded-xl border border-earth-700 bg-earth-800 px-3 text-sm text-earth-300 shadow-inner focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50 [color-scheme:dark]"
          />
        </div>

        {/* สถานะรถ */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-earth-400">
            สถานะรถ
          </label>
          <select
            name="direction" // ใช้ชื่อเดิมแต่ความหมายคือ status
            value={filters.direction || "all"}
            onChange={handleChange}
            className="h-11 rounded-xl border border-earth-700 bg-earth-800 px-3 text-sm text-earth-300 shadow-inner focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50"
          >
            <option value="all">ทั้งหมด</option>
            <option value="parked">กำลังจอด</option>
            <option value="completed">ออกแล้ว</option>
            <option value="unmatched">ไม่พบข้อมูลขาเข้า</option>
          </select>
        </div>

        {/* ประเภทบุคคล */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-earth-400">
            ประเภทบุคคล
          </label>
          <select
            name="personType"
            value={filters.personType || "all"}
            onChange={handleChange}
            className="h-11 rounded-xl border border-earth-700 bg-earth-800 px-3 text-sm text-earth-300 shadow-inner focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50"
          >
            <option value="all">ทั้งหมด</option>
            <option value="inside">บุคคลภายใน</option>
            <option value="outside">บุคคลภายนอก</option>
          </select>
        </div>

        {/* ค้นหาทะเบียน */}
        <div className="flex flex-col gap-1 lg:col-span-1">
          <label className="text-xs font-medium text-earth-400">
            ค้นหาทะเบียน
          </label>
          <input
            type="text"
            name="query"
            placeholder="เช่น 6ษษ9272"
            value={filters.query || ""}
            onChange={handleChange}
            className="h-11 rounded-xl border border-earth-700 bg-earth-800 px-3 text-sm text-earth-300 shadow-inner placeholder:text-earth-500 focus:border-earth-500 focus:outline-none focus:ring-2 focus:ring-earth-500/50"
          />
        </div>
      </div>

      {/* ปุ่มด้านขวา */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center mt-4 md:mt-0">
        <button
          type="button"
          onClick={onApply}
          className="h-11 rounded-xl bg-earth-600 px-5 text-sm font-bold text-white shadow-[0_0_12px_rgba(88,129,87,0.4)] hover:bg-earth-500 hover:shadow-[0_0_16px_rgba(88,129,87,0.6)] focus:outline-none focus:ring-2 focus:ring-earth-400 focus:ring-offset-2 focus:ring-offset-earth-900 transition-all"
        >
          ใช้ฟิลเตอร์
        </button>
        <button
          type="button"
          onClick={onReset}
          className="h-11 rounded-xl border border-earth-700 bg-earth-800 px-5 text-sm font-medium text-earth-300 shadow-sm hover:bg-earth-700 focus:outline-none focus:ring-2 focus:ring-earth-500 focus:ring-offset-2 focus:ring-offset-earth-900 transition-all"
        >
          ล้างฟิลเตอร์
        </button>
        <button
          type="button"
          onClick={onExport}
          className="h-11 rounded-xl bg-[#10b981] px-5 text-sm font-bold text-white shadow-[0_0_12px_rgba(16,185,129,0.4)] hover:bg-[#059669] hover:shadow-[0_0_16px_rgba(16,185,129,0.6)] focus:outline-none focus:ring-2 focus:ring-[#34d399] focus:ring-offset-2 focus:ring-offset-earth-900 transition-all"
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}
