// src/components/WeeklyBarChart.jsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function EmptyState({ text = "ยังไม่มีข้อมูลในช่วงที่เลือก" }) {
  return (
    <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
      {text}
    </div>
  );
}

export default function WeeklyBarChart({ data = [], height = 280 }) {
  const safe = Array.isArray(data) ? data : [];
  const noData = safe.length === 0 || safe.every(d => (d.count ?? 0) === 0);
  if (noData) return <EmptyState />;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={safe} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          {/* ไล่เฉดสีของแท่ง */}
          <defs>
            <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" />   {/* sky-400 */}
              <stop offset="100%" stopColor="#2563eb" /> {/* indigo-600 */}
            </linearGradient>
            <linearGradient id="barFillActive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />  {/* cyan-400 */}
              <stop offset="100%" stopColor="#6366f1" />{/* indigo-500 */}
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis allowDecimals={false} />
          <Tooltip formatter={(v) => [v, "รถเข้า"]} />

          <Bar
            dataKey="count"
            name="รถเข้า"
            fill="url(#barFill)"
            radius={[8, 8, 0, 0]}
            activeBar={{ fill: "url(#barFillActive)" }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
