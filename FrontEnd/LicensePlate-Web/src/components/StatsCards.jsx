export default function StatsCards({ stats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-white rounded-2xl shadow-xl p-6 border-t-4 border-indigo-500 transform hover:scale-[1.01] transition-transform duration-300">
        <p className="text-sm font-semibold text-indigo-600 uppercase mb-1">
          ทั้งหมด
        </p>
        <h2 className="text-5xl font-extrabold text-slate-800 tracking-tight">
          {stats.total}
        </h2>
        <p className="text-xs text-slate-500 mt-1">จำนวนการตรวจจับทั้งหมด</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6 border-t-4 border-green-500 transform hover:scale-[1.01] transition-transform duration-300">
        <p className="text-sm font-semibold text-green-600 uppercase mb-1">
          เข้า (IN)
        </p>
        <h2 className="text-5xl font-extrabold text-slate-800 tracking-tight">
          {stats.in}
        </h2>
        <p className="text-xs text-slate-500 mt-1">รถเข้าพื้นที่</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6 border-t-4 border-red-500 transform hover:scale-[1.01] transition-transform duration-300">
        <p className="text-sm font-semibold text-red-600 uppercase mb-1">
          ออก (OUT)
        </p>
        <h2 className="text-5xl font-extrabold text-slate-800 tracking-tight">
          {stats.out}
        </h2>
        <p className="text-xs text-slate-500 mt-1">รถออกจากพื้นที่</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6 border-t-4 border-yellow-500 transform hover:scale-[1.01] transition-transform duration-300">
        <p className="text-sm font-semibold text-yellow-600 uppercase mb-1">
          ป้ายไม่รู้จัก
        </p>
        <h2 className="text-5xl font-extrabold text-slate-800 tracking-tight">
          {stats.unknown}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          ไม่สามารถระบุป้ายทะเบียนได้
        </p>
      </div>
    </div>
  );
}
