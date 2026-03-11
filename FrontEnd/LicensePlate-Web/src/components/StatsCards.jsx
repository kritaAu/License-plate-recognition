export default function StatsCards({ stats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-earth-900/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-earth-800 border-t-4 border-t-earth-400 transform hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-earth-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <p className="text-sm font-semibold text-earth-300 uppercase mb-1 tracking-wider">
          ทั้งหมด
        </p>
        <h2 className="text-5xl font-extrabold text-white tracking-tight drop-shadow-md">
          {stats.total}
        </h2>
        <p className="text-xs text-earth-400 mt-2 font-medium">จำนวนการตรวจจับทั้งหมด</p>
      </div>

      <div className="bg-earth-900/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-earth-800 border-t-4 border-t-[#10b981] transform hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-[#10b981]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <p className="text-sm font-semibold text-[#10b981] uppercase mb-1 tracking-wider">
          เข้า (IN)
        </p>
        <h2 className="text-5xl font-extrabold text-white tracking-tight drop-shadow-md">
          {stats.in}
        </h2>
        <p className="text-xs text-earth-400 mt-2 font-medium">รถเข้าพื้นที่</p>
      </div>

      <div className="bg-earth-900/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-earth-800 border-t-4 border-t-terra-500 transform hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-terra-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <p className="text-sm font-semibold text-terra-400 uppercase mb-1 tracking-wider">
          ออก (OUT)
        </p>
        <h2 className="text-5xl font-extrabold text-white tracking-tight drop-shadow-md">
          {stats.out}
        </h2>
        <p className="text-xs text-earth-400 mt-2 font-medium">รถออกจากพื้นที่</p>
      </div>

      <div className="bg-earth-900/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-earth-800 border-t-4 border-t-earth-200 transform hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-earth-300/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <p className="text-sm font-semibold text-earth-200 uppercase mb-1 tracking-wider">
          ป้ายไม่รู้จัก
        </p>
        <h2 className="text-5xl font-extrabold text-white tracking-tight drop-shadow-md">
          {stats.unknown}
        </h2>
        <p className="text-xs text-earth-400 mt-2 font-medium">
          ไม่สามารถระบุป้ายทะเบียนได้
        </p>
      </div>
    </div>
  );
}
