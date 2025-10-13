export default function Filters({ filters, setFilters, onApply, onReset }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">วันที่เริ่ม</label>
          <input
            type="date"
            name="start"
            value={filters.start}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">วันสิ้นสุด</label>
          <input
            type="date"
            name="end"
            value={filters.end}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ทิศทาง</label>
          <select
            name="direction"
            value={filters.direction}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">ทั้งหมด</option>
            <option value="in">เข้า</option>
            <option value="out">ออก</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ค้นหาทะเบียน</label>
          <input
            type="text"
            name="query"
            placeholder="เช่น กก1234"
            value={filters.query}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <button
          onClick={onApply}
          className="w-full py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium"
        >
          ใช้ฟิลเตอร์
        </button>
        <button
          onClick={onReset}
          className="w-full py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium"
        >
          ล้างฟิลเตอร์
        </button>
      </div>
    </>
  );
}
