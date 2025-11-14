// src/components/Filters.jsx
export default function Filters({ filters, setFilters, onApply, onReset, onExport }) {
  const set = (name) => (e) => setFilters((s) => ({ ...s, [name]: e.target.value }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onApply(); }}
      className="grid gap-4 md:grid-cols-4 items-end"
    >
      <div>
        <label className="block text-sm text-slate-600 mb-1">วันที่เริ่ม</label>
        <input
          type="date"
          value={filters.start}
          onChange={set("start")}
          className="w-full rounded-lg border bg-white px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-600 mb-1">วันที่สิ้นสุด</label>
        <input
          type="date"
          value={filters.end}
          onChange={set("end")}
          className="w-full rounded-lg border bg-white px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-600 mb-1">ทิศทาง</label>
        <select
          value={filters.direction}
          onChange={set("direction")}
          className="w-full rounded-lg border bg-white px-3 py-2"
        >
          <option value="all">ทั้งหมด</option>
          <option value="IN">เข้า</option>
          <option value="OUT">ออก</option>
        </select>
      </div>

      <div>
        <label className="block text-sm text-slate-600 mb-1">ค้นหาทะเบียน</label>
        <input
          placeholder="เช่น 6ษย9272"
          value={filters.query}
          onChange={set("query")}
          className="w-full rounded-lg border bg-white px-3 py-2"
        />
      </div>

      <div className="md:col-span-4 flex gap-3">
        <button
          type="submit"
          className="rounded-lg bg-[#2a567b] px-6 py-2 font-medium text-white hover:brightness-110"
        >
          ใช้ฟิลเตอร์
        </button>

        <button
          type="button"
          onClick={onReset}
          className="rounded-lg bg-white px-6 py-2 font-medium text-[#2a567b] ring-1 ring-[#2a567b]"
        >
          ล้างฟิลเตอร์
        </button>

        <button
          type="button"
          onClick={onExport}
          className="ml-auto rounded-lg bg-rose-100 px-6 py-2 font-medium text-rose-700 hover:bg-rose-200"
        >
          Export CSV
        </button>
      </div>
    </form>
  );
}
