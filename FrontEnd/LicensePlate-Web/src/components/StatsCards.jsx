export default function StatsCards({ stats }) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-[#b3cde0] rounded-lg shadow-sm p-6">
        <p className="text-sm text-gray-600 mb-2">ทั้งหมด</p>
        <h2 className="text-4xl font-bold text-gray-800">{stats.total}</h2>
      </div>
      <div className="bg-[#b3cde0] rounded-lg shadow-sm p-6">
        <p className="text-sm text-gray-600 mb-2">เข้า (in)</p>
        <h2 className="text-4xl font-bold text-gray-800">{stats.in}</h2>
      </div>
      <div className="bg-[#b3cde0] rounded-lg shadow-sm p-6">
        <p className="text-sm text-gray-600 mb-2">ออก (out)</p>
        <h2 className="text-4xl font-bold text-gray-800">{stats.out}</h2>
      </div>
      <div className="bg-[#b3cde0] rounded-lg shadow-sm p-6">
        <p className="text-sm text-gray-600 mb-2">ป้ายไม่รู้จัก</p>
        <h2 className="text-4xl font-bold text-gray-800">{stats.unknown}</h2>
      </div>
    </div>
  );
}
