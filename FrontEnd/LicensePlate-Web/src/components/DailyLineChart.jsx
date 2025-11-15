// src/components/DailyLineChart.jsx
import { useMemo, useRef, useState } from "react";

/**
 * props:
 *  - data: [{ label: "00:00", in: number, out: number }, ...]
 *  - height: number (default 260)
 *  - fontScale: number (default 1.25)  // ปรับขนาดตัวอักษรทั้งกราฟ
 */
export default function DailyLineChart({ data = [], height = 260, fontScale = 1.25 }) {
  const svgRef = useRef(null);

  // ขนาดกราฟ (ใช้ viewBox ให้ responsive)
  const W = 800;
  const H = Math.max(200, height);
  const M = { top: 22, right: 18, bottom: 34, left: 48 };
  const PW = W - M.left - M.right;
  const PH = H - M.top - M.bottom;

  // ขนาดตัวอักษร/เส้น (ปรับด้วย fontScale)
  const FS_AXIS = Math.round(11 * fontScale);
  const FS_TICK = Math.round(12 * fontScale);
  const FS_LEGEND = Math.round(13 * fontScale);
  const FS_TT_TITLE = Math.round(13 * fontScale);
  const FS_TT_VAL = Math.round(15 * fontScale);
  const STROKE_W = Math.max(2.5, 3 * (fontScale / 1.25));
  const DOT_R = Math.max(3, 3.2 * (fontScale / 1.25));

  const n = Math.max(1, data.length || 0);
  const step = n > 1 ? PW / (n - 1) : 1;

  const maxY = useMemo(() => {
    const m = Math.max(
      1,
      ...data.map((d) => Math.max(Number(d.in || 0), Number(d.out || 0)))
    );
    return m;
  }, [data]);

  const x = (i) => M.left + i * step;
  const y = (v) => M.top + PH - (PH * v) / maxY;

  const pathOf = (key) => {
    if (!n) return "";
    let d = "";
    for (let i = 0; i < n; i++) {
      const xv = x(i);
      const yv = y(Number(data[i]?.[key] || 0));
      d += (i === 0 ? "M" : "L") + xv + " " + yv + " ";
    }
    return d;
  };

  // tooltip state
  const [hover, setHover] = useState(null);
  const showTooltip = (e) => {
    if (!svgRef.current || n < 1) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const viewX = (px / rect.width) * W;
    let i = Math.round((viewX - M.left) / step);
    if (i < 0) i = 0;
    if (i > n - 1) i = n - 1;
    const item = data[i] || {};
    setHover({
      i,
      x: x(i),
      yIn: y(Number(item.in || 0)),
      yOut: y(Number(item.out || 0)),
      label: item.label || "",
      in: Number(item.in || 0),
      out: Number(item.out || 0),
    });
  };
  const hideTooltip = () => setHover(null);

  if (!data.length || maxY <= 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-base text-slate-600">
        ยังไม่มีข้อมูลในวันที่เลือก
      </div>
    );
  }

  const showXLabel = (i) => i % 2 === 0; // เว้น label ทุก 2 ชั่วโมงให้อ่านง่าย
  const yTicks = Array.from({ length: 5 }, (_, k) => Math.round((maxY * k) / 4));

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        onMouseMove={showTooltip}
        onMouseLeave={hideTooltip}
        role="img"
        aria-label="สถิติรายวันรถเข้า-ออก"
      >
        {/* พื้นหลัง plot */}
        <rect x={M.left} y={M.top} width={PW} height={PH} fill="white" rx="10" />

        {/* กริด & y-labels */}
        {yTicks.map((t, idx) => {
          const yy = y(t);
          return (
            <g key={idx}>
              <line
                x1={M.left}
                y1={yy}
                x2={M.left + PW}
                y2={yy}
                stroke="#e5e7eb"
                strokeDasharray="4 4"
              />
              <text
                x={M.left - 10}
                y={yy + 4}
                textAnchor="end"
                fontSize={FS_AXIS}
                fill="#475569"
              >
                {t}
              </text>
            </g>
          );
        })}

        {/* เส้นกราฟ: เข้า (เขียว) */}
        <path
          d={pathOf("in")}
          fill="none"
          stroke="#16a34a"
          strokeWidth={STROKE_W}
          vectorEffect="non-scaling-stroke"
        />

        {/* เส้นกราฟ: ออก (แดง) */}
        <path
          d={pathOf("out")}
          fill="none"
          stroke="#ef4444"
          strokeWidth={STROKE_W}
          vectorEffect="non-scaling-stroke"
        />

        {/* จุดบนเส้น */}
        {data.map((d, i) => (
          <g key={`dots-${i}`}>
            <circle cx={x(i)} cy={y(Number(d.in || 0))} r={DOT_R} fill="#16a34a" />
            <circle cx={x(i)} cy={y(Number(d.out || 0))} r={DOT_R} fill="#ef4444" />
          </g>
        ))}

        {/* แกน X */}
        {data.map((d, i) =>
          showXLabel(i) ? (
            <text
              key={`x-${i}`}
              x={x(i)}
              y={H - 6}
              fontSize={FS_TICK}
              textAnchor="middle"
              fill="#475569"
            >
              {d.label}
            </text>
          ) : null
        )}

        {/* overlay จับเมาส์ */}
        <rect
          x={M.left}
          y={M.top}
          width={PW}
          height={PH}
          fill="transparent"
          style={{ cursor: "crosshair" }}
        />

        {/* Tooltip */}
        {hover && (
          <g>
            {/* เส้นไกด์แนวตั้ง */}
            <line
              x1={hover.x}
              y1={M.top}
              x2={hover.x}
              y2={M.top + PH}
              stroke="#94a3b8"
              strokeDasharray="4 4"
            />

            {/* จุดเน้น */}
            <circle cx={hover.x} cy={hover.yIn} r={DOT_R + 1.5} fill="#16a34a" stroke="white" />
            <circle cx={hover.x} cy={hover.yOut} r={DOT_R + 1.5} fill="#ef4444" stroke="white" />

            {/* กล่อง tooltip ใหญ่ขึ้น */}
            {(() => {
              const boxW = 210;    // กว้างขึ้น
              const boxH = 64;     // สูงขึ้น
              const pad = 10;
              const boxX = Math.min(Math.max(hover.x + 12, M.left + 4), M.left + PW - boxW - 4);
              const topY = Math.min(hover.yIn, hover.yOut);
              const boxY = Math.max(M.top + 6, topY - (boxH + 6));

              return (
                <g transform={`translate(${boxX}, ${boxY})`}>
                  <rect width={boxW} height={boxH} rx="10" fill="white" stroke="#e2e8f0" />
                  <text x={pad} y={pad + FS_TT_TITLE} fontSize={FS_TT_TITLE} fill="#334155">
                    {hover.label}
                  </text>
                  <g>
                    <circle cx={pad + 2} cy={boxH / 2} r="5" fill="#16a34a" />
                    <text x={pad + 14} y={boxH / 2 + 4} fontSize={FS_TT_VAL} fill="#0f172a">
                      รถเข้า (IN): {hover.in}
                    </text>
                  </g>
                  <g>
                    <circle cx={pad + 2} cy={boxH - 14} r="5" fill="#ef4444" />
                    <text x={pad + 14} y={boxH - 10} fontSize={FS_TT_VAL} fill="#0f172a">
                      รถออก (OUT): {hover.out}
                    </text>
                  </g>
                </g>
              );
            })()}
          </g>
        )}
      </svg>

      {/* Legend ใหญ่ขึ้น */}
      <div className="mt-3 flex items-center gap-7">
        <span className="inline-flex items-center gap-3" style={{ fontSize: FS_LEGEND }}>
          <span className="inline-block h-3 w-6 rounded-sm" style={{ background: "#16a34a" }} />
          รถเข้า (IN)
        </span>
        <span className="inline-flex items-center gap-3" style={{ fontSize: FS_LEGEND }}>
          <span className="inline-block h-3 w-6 rounded-sm" style={{ background: "#ef4444" }} />
          รถออก (OUT)
        </span>
      </div>
    </div>
  );
}
