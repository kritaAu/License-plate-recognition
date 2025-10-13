import { useState } from 'react';

function App() {
  const [filters, setFilters] = useState({
    start: "2025-08-01",
    end: "2025-08-09",
    direction: "all",
    query: "",
  });

  const stats = {
    total: 156,
    in: 97,
    out: 46,
    unknown: 13,
  };

  const lineData = [
    { month: 'ม.ค.', dataset1: 200, dataset2: 300 },
    { month: 'ก.พ.', dataset1: 280, dataset2: 350 },
    { month: 'มี.ค.', dataset1: 150, dataset2: 280 },
    { month: 'เม.ย.', dataset1: 320, dataset2: 200 },
    { month: 'พ.ค.', dataset1: 280, dataset2: 320 },
    { month: 'มิ.ย.', dataset1: 350, dataset2: 280 },
    { month: 'ก.ค.', dataset1: 300, dataset2: 350 },
  ];

  const barData = [
    { month: 'ม.ค.', dataset1: 400, dataset2: 350 },
    { month: 'ก.พ.', dataset1: 350, dataset2: 420 },
    { month: 'มี.ค.', dataset1: 450, dataset2: 300 },
    { month: 'เม.ย.', dataset1: 300, dataset2: 380 },
    { month: 'พ.ค.', dataset1: 500, dataset2: 420 },
    { month: 'มิ.ย.', dataset1: 450, dataset2: 350 },
    { month: 'ก.ค.', dataset1: 380, dataset2: 400 },
  ];

  const records = [
    { time: "8/9/2568 13:06:03", plate: "234 พนก กรุงเทพมหานคร", status: "เข้า", check: "บุคคลภายใน", img: "🏍️" },
    { time: "8/9/2568 12:06:03", plate: "97 ขม กรุงเทพมหานคร", status: "ออก", check: "บุคคลภายใน", img: "🏍️" },
    { time: "8/9/2568 11:06:03", plate: "98 กผก สระบุรี", status: "เข้า", check: "บุคคลภายใน", img: "🏍️" },
    { time: "8/9/2568 10:06:03", plate: "123 กอ สมุทรสาคร", status: "เข้า", check: "บุคคลภายนอก", img: "🏍️" },
    { time: "7/9/2568 13:06:03", plate: "986 มอ กรุงเทพมหานคร", status: "ออก", check: "บุคคลภายใน", img: "🏍️" },
    { time: "6/9/2568 13:06:03", plate: "375 บส กรุงเทพมหานคร", status: "เข้า", check: "บุคคลภายนอก", img: "🏍️" },
    { time: "6/9/2568 12:06:03", plate: "9086 ขบ กรุงเทพมหานคร", status: "เข้า", check: "บุคคลภายใน", img: "🏍️" },
    { time: "6/9/2568 09:06:03", plate: "2035 ขบ กรุงเทพมหานคร", status: "ออก", check: "บุคคลภายนอก", img: "🏍️" },
  ];

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // Custom Line Chart Component
  const LineChart = ({ data }) => {
    const maxValue = Math.max(...data.flatMap(d => [d.dataset1, d.dataset2]));
    const height = 200;
    const width = 500;
    const padding = 40;
    
    const getX = (index) => padding + (index * (width - padding * 2) / (data.length - 1));
    const getY = (value) => height - padding - ((value / maxValue) * (height - padding * 2));
    
    const points1 = data.map((d, i) => `${getX(i)},${getY(d.dataset1)}`).join(' ');
    const points2 = data.map((d, i) => `${getX(i)},${getY(d.dataset2)}`).join(' ');
    
    return (
      <div className="relative">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e5e7eb" strokeWidth="1" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" strokeWidth="1" />
          
          {[0, 1, 2, 3, 4].map(i => (
            <line 
              key={i}
              x1={padding} 
              y1={padding + i * (height - padding * 2) / 4} 
              x2={width - padding} 
              y2={padding + i * (height - padding * 2) / 4} 
              stroke="#f3f4f6" 
              strokeWidth="1" 
            />
          ))}
          
          <polyline points={points1} fill="none" stroke="#FCD34D" strokeWidth="2" />
          <polyline points={points2} fill="none" stroke="#93C5FD" strokeWidth="2" />
          
          {data.map((d, i) => (
            <g key={i}>
              <circle cx={getX(i)} cy={getY(d.dataset1)} r="4" fill="#FCD34D" />
              <circle cx={getX(i)} cy={getY(d.dataset2)} r="4" fill="#93C5FD" />
            </g>
          ))}
          
          {data.map((d, i) => (
            <text 
              key={i}
              x={getX(i)} 
              y={height - padding + 20} 
              textAnchor="middle" 
              fontSize="12" 
              fill="#6b7280"
            >
              {d.month}
            </text>
          ))}
        </svg>
        <div className="flex items-center justify-center gap-4 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-300 rounded"></div>
            <span className="text-xs text-gray-600">Dataset 1</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-300 rounded"></div>
            <span className="text-xs text-gray-600">Dataset 2</span>
          </div>
        </div>
      </div>
    );
  };

  // Custom Bar Chart Component
  const BarChart = ({ data }) => {
    const maxValue = Math.max(...data.flatMap(d => [d.dataset1, d.dataset2]));
    const height = 200;
    const width = 500;
    const padding = 40;
    const barWidth = (width - padding * 2) / (data.length * 2.5);
    
    const getHeight = (value) => ((value / maxValue) * (height - padding * 2));
    
    return (
      <div className="relative">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e5e7eb" strokeWidth="1" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" strokeWidth="1" />
          
          {[0, 1, 2, 3, 4].map(i => (
            <line 
              key={i}
              x1={padding} 
              y1={padding + i * (height - padding * 2) / 4} 
              x2={width - padding} 
              y2={padding + i * (height - padding * 2) / 4} 
              stroke="#f3f4f6" 
              strokeWidth="1" 
            />
          ))}
          
          {data.map((d, i) => {
            const x = padding + (i * (width - padding * 2) / data.length) + 10;
            const h1 = getHeight(d.dataset1);
            const h2 = getHeight(d.dataset2);
            
            return (
              <g key={i}>
                <rect 
                  x={x} 
                  y={height - padding - h1} 
                  width={barWidth} 
                  height={h1} 
                  fill="#F9A8D4"
                />
                <rect 
                  x={x + barWidth + 2} 
                  y={height - padding - h2} 
                  width={barWidth} 
                  height={h2} 
                  fill="#93C5FD"
                />
                <text 
                  x={x + barWidth} 
                  y={height - padding + 20} 
                  textAnchor="middle" 
                  fontSize="12" 
                  fill="#6b7280"
                >
                  {d.month}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex items-center justify-center gap-4 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-pink-300 rounded"></div>
            <span className="text-xs text-gray-600">Dataset 1</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-300 rounded"></div>
            <span className="text-xs text-gray-600">Dataset 2</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 ">
      <div className="max-w-7xl mx-auto px-6 py-6 bg-red-500">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">วันที่เริ่ม</label>
              <input
                type="date"
                name="start"
                value={filters.start}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">วันสิ้นสุด</label>
              <input
                type="date"
                name="end"
                value={filters.end}
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ทิศทาง</label>
              <select
                name="direction"
                value={filters.direction}
                onChange={handleFilterChange}
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
                onChange={handleFilterChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <button className="w-full py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium">
              ใช้ฟิลเตอร์
            </button>
            <button className="w-full py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium">
              ล้างฟิลเตอร์
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-2">ทั้งหมด</p>
            <h2 className="text-4xl font-bold text-gray-800">{stats.total}</h2>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-2">เข้า (in)</p>
            <h2 className="text-4xl font-bold text-gray-800">{stats.in}</h2>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-2">ออก (out)</p>
            <h2 className="text-4xl font-bold text-gray-800">{stats.out}</h2>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-2">ป้ายไม่รู้จัก</p>
            <h2 className="text-4xl font-bold text-gray-800">{stats.unknown}</h2>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">สถิติรายเดือน</h3>
            <LineChart data={lineData} />
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">สถิติรายวัน</h3>
            <BarChart data={barData} />
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">รายการล่าสุด</h3>
            <span className="text-sm text-gray-500">Items 8 items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">เวลา</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">ทะเบียน</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">ทิศทาง</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">สถานะ</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">ภาพ</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-700">{record.time}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{record.plate}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        record.status === "เข้า" 
                          ? "bg-blue-100 text-blue-700" 
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        record.check === "บุคคลภายใน" 
                          ? "bg-green-100 text-green-700" 
                          : "bg-red-100 text-red-700"
                      }`}>
                        {record.check}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-16 h-12 bg-gray-200 rounded flex items-center justify-center text-2xl">
                        {record.img}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;