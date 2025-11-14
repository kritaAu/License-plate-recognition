// src/components/DailyLineChart.jsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function EmptyState({ text = "ยังไม่มีข้อมูลในวันที่เลือก" }) {
  return (
    <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
      {text}
    </div>
  );
}

const COLORS = {
  internal: "#16a34a", // เขียว (บุคคลภายใน)
  external: "#dc2626", // แดง  (บุคคลภายนอก)
};

export default function DailyLineChart({ data = [], height = 260 }) {
  const noData =
    !Array.isArray(data) ||
    data.length === 0 ||
    data.every(
      (d) => (d.internal ?? 0) === 0 && (d.external ?? 0) === 0
    );

  if (noData) return <EmptyState />;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis allowDecimals={false} />
          <Tooltip
            formatter={(value, key) => [
              value,
              key === "internal" ? "บุคคลภายใน" : "บุคคลภายนอก",
            ]}
          />
          <Legend />
          {/* สีเขียว = คนใน */}
          <Line
            type="monotone"
            dataKey="internal"
            name="บุคคลภายใน"
            stroke={COLORS.internal}
            strokeWidth={2.5}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
          {/* สีแดง = คนนอก */}
          <Line
            type="monotone"
            dataKey="external"
            name="บุคคลภายนอก"
            stroke={COLORS.external}
            strokeWidth={2.5}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
