export default function DailyLineChart({ series = [] }) {
  if (!Array.isArray(series) || series.length === 0) {
    return <div className="text-sm text-gray-400">ยังไม่มีข้อมูล</div>;
  }

  const height = 240, width = 560, pad = 40;

  const maxY = Math.max(
    1,
    ...series.flatMap(d => [
      Number.isFinite(d?.inside) ? d.inside : 0,
      Number.isFinite(d?.outside) ? d.outside : 0,
    ])
  );

  const denom = Math.max(1, series.length - 1); // กันหารศูนย์เมื่อมี 1 จุด
  const stepX = (width - pad * 2) / denom;

  const getX = (i) => pad + i * stepX;
  const getY = (v) => {
    const n = Number.isFinite(v) ? v : 0;
    return height - pad - (n / maxY) * (height - pad * 2);
  };

  const toPoints = (k) =>
    series
      .map((d, i) => `${getX(i)},${getY(d?.[k])}`)
      .join(" ");

  return (
    <div className="relative">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* axes */}
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#e5e7eb" />
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#e5e7eb" />

        {/* grid */}
        {[0, 1, 2, 3, 4].map((i) => {
          const y = pad + (i * (height - pad * 2)) / 4;
          return <line key={i} x1={pad} y1={y} x2={width - pad} y2={y} stroke="#f3f4f6" />;
        })}

        {/* lines */}
        <polyline points={toPoints("inside")}  fill="none" stroke="#6366F1" strokeWidth="2.5" />
        <polyline points={toPoints("outside")} fill="none" stroke="#F59E0B" strokeWidth="2.5" />

        {/* dots */}
        {series.map((d, i) => (
          <g key={i}>
            <circle cx={getX(i)} cy={getY(d?.inside)}  r="3.5" fill="#6366F1" />
            <circle cx={getX(i)} cy={getY(d?.outside)} r="3.5" fill="#F59E0B" />
          </g>
        ))}

        {/* x labels (แสดงทุก 2 จุด) */}
        {series.map((d, i) =>
          i % 2 === 0 ? (
            <text
              key={`lbl-${i}`}
              x={getX(i)}
              y={height - pad + 16}
              textAnchor="middle"
              fontSize="10"
              fill="#6b7280"
            >
              {d?.label ?? ""}
            </text>
          ) : null
        )}

        {/* y max label */}
        <text x={pad - 8} y={pad - 8} textAnchor="end" fontSize="10" fill="#6b7280">
          {maxY}
        </text>
      </svg>

      {/* legend */}
      <div className="flex items-center gap-4 mt-1">
        <span className="inline-flex items-center gap-2 text-sm text-gray-600">
          <span className="w-3 h-3 rounded-sm" style={{ background: "#6366F1" }} /> บุคคลภายใน
        </span>
        <span className="inline-flex items-center gap-2 text-sm text-gray-600">
          <span className="w-3 h-3 rounded-sm" style={{ background: "#F59E0B" }} /> บุคคลภายนอก
        </span>
      </div>
    </div>
  );
}
