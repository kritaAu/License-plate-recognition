export default function WeeklyBarChart({ data = [] }) {
  // data: [{ label: '3 สัปดาห์ก่อน', count: 12 }, ... ]
  const width = 640;
  const height = 240;
  const padding = { top: 28, right: 24, bottom: 40, left: 24 };

  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(1, ...data.map(d => d.count || 0));
  const barGap = 16;
  const barW = Math.max(12, Math.floor((innerW - barGap * (data.length - 1)) / data.length));

  const getX = (i) => padding.left + i * (barW + barGap);
  const getY = (count) => padding.top + innerH - (count / max) * innerH;

  return (
    <div className="relative">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="กราฟแท่งรายสัปดาห์">
        {/* แกน X */}
        <line
          x1={padding.left}
          y1={padding.top + innerH}
          x2={padding.left + innerW}
          y2={padding.top + innerH}
          stroke="#e2e8f0"
        />

        {/* แท่ง */}
        {data.map((d, i) => {
          const x = getX(i);
          const y = getY(d.count);
          const h = padding.top + innerH - y;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx="8"
                className="fill-sky-500/90 hover:fill-sky-600 transition-colors"
              />
              {/* value */}
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                className="fill-slate-700 text-[12px] font-medium"
              >
                {d.count ?? 0}
              </text>
              {/* label */}
              <text
                x={x + barW / 2}
                y={padding.top + innerH + 16}
                textAnchor="middle"
                className="fill-slate-600 text-[12px]"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}