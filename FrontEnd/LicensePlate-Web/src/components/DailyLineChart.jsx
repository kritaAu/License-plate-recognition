import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

function EmptyState({ text = "ยังไม่มีข้อมูลในวันที่เลือก" }) {
  return <div className="h-40 flex items-center justify-center text-slate-500 text-sm">{text}</div>;
}

const LABELS = { external: "บุคคลภายนอก", internal: "บุคคลภายใน" };

export default function DailyLineChart({ data = [], height = 260 }) {
  const noData =
    !Array.isArray(data) ||
    data.length === 0 ||
    data.every(d => (d.internal ?? 0) === 0 && (d.external ?? 0) === 0);

  if (noData) return <EmptyState />;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis allowDecimals={false} />

          {/* แปลคีย์ internal/external เป็นไทยให้ทั้ง tooltip และ legend */}
          <Tooltip
            formatter={(value, key) => [value, LABELS[key] ?? key]}
            labelFormatter={(label) => `${label}`}
          />
          <Legend formatter={(key) => LABELS[key] ?? key} />

          {/* ภายนอก = สีแดง, ภายใน = สีเขียว */}
          <Line
            type="monotone"
            dataKey="external"
            name="external"
            stroke="#ef4444"
            dot={{ r: 2 }}
            activeDot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="internal"
            name="internal"
            stroke="#22c55e"
            dot={{ r: 2 }}
            activeDot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
