export default function LineChart({ data }) {
  if (!data.length) return <div className="text-sm text-gray-400">ยังไม่มีข้อมูล</div>;

  const maxValue = Math.max(...data.flatMap((d) => [d.dataset1, d.dataset2]));
  const height = 200;
  const width = 500;
  const padding = 40;

  const getX = (index) => padding + (index * (width - padding * 2)) / (data.length - 1);
  const getY = (value) => height - padding - (value / maxValue) * (height - padding * 2);

  const points1 = data.map((d, i) => `${getX(i)},${getY(d.dataset1)}`).join(' ');
  const points2 = data.map((d, i) => `${getX(i)},${getY(d.dataset2)}`).join(' ');

  return (
    <div className="relative">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e5e7eb" strokeWidth="1" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" strokeWidth="1" />
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={padding}
            y1={padding + (i * (height - padding * 2)) / 4}
            x2={width - padding}
            y2={padding + (i * (height - padding * 2)) / 4}
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
          <text key={i} x={getX(i)} y={height - padding + 20} textAnchor="middle" fontSize="12" fill="#6b7280">
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
}
