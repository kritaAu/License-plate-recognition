export default function BarChart({ data = [] }) {
  if (!data.length) return <div className="text-sm text-gray-400">ยังไม่มีข้อมูล</div>;

  // กัน maxValue = 0 และกันค่าไม่เป็นตัวเลข
  const maxValue = Math.max(
    1,
    ...data.flatMap(d => [
      Number.isFinite(d?.dataset1) ? d.dataset1 : 0,
      Number.isFinite(d?.dataset2) ? d.dataset2 : 0,
    ])
  );

  const height = 200;
  const width = 500;
  const padding = 40;

  // กันหารศูนย์กรณี data.length เล็กมาก
  const safeLen = Math.max(1, data.length);
  const barWidth = (width - padding * 2) / (safeLen * 2.5);

  const getHeight = (value) =>
    ((Number.isFinite(value) ? value : 0) / maxValue) * (height - padding * 2);

  return (
    <div className="relative">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* axes */}
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e5e7eb" strokeWidth="1" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" strokeWidth="1" />

        {/* grid */}
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

        {/* bars */}
        {data.map((d, i) => {
          const x = padding + (i * (width - padding * 2)) / safeLen + 10; // ใช้ safeLen
          const h1 = getHeight(d?.dataset1);
          const h2 = getHeight(d?.dataset2);
          return (
            <g key={i}>
              <rect x={x} y={height - padding - h1} width={barWidth} height={h1} fill="#F9A8D4" />
              <rect x={x + barWidth + 2} y={height - padding - h2} width={barWidth} height={h2} fill="#93C5FD" />
              <text x={x + barWidth} y={height - padding + 20} textAnchor="middle" fontSize="12" fill="#6b7280">
                {d?.month ?? ''}
              </text>
            </g>
          );
        })}
      </svg>

      {/* legend */}
      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-pink-300 rounded" />
          <span className="text-xs text-gray-600">Dataset 1</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-300 rounded" />
          <span className="text-xs text-gray-600">Dataset 2</span>
        </div>
      </div>
    </div>
  );
}
