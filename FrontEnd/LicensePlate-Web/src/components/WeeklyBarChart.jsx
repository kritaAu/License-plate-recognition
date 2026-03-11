import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
} from "recharts";

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const pIn = payload.find((p) => p.dataKey === "in")?.value ?? 0;
  const pOut = payload.find((p) => p.dataKey === "out")?.value ?? 0;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <div className="text-xs font-semibold text-slate-200">{label}</div>
      <div className="mt-1 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#10b981]" />
          รถเข้า (IN): <b className="ml-1 text-slate-100">{pIn}</b>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#f43f5e]" />
          รถออก (OUT): <b className="ml-1 text-slate-100">{pOut}</b>
        </div>
      </div>
    </div>
  );
}

export default function WeeklyBarChart({ data = [] }) {
  // รองรับ data แบบเก่า {label,count} โดยแปลงเป็น {label,in,out}
  const normalized = (Array.isArray(data) ? data : []).map((d) => ({
    label: d.label,
    in:
      typeof d.in === "number"
        ? d.in
        : typeof d.count === "number"
        ? d.count
        : 0,
    out: typeof d.out === "number" ? d.out : 0,
  }));

  const hasAny = normalized.some((d) => (d.in || 0) + (d.out || 0) > 0);

  return (
    <div className="w-full h-[280px]">
      {!hasAny ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          ยังไม่มีข้อมูลในช่วงที่เลือก
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={normalized}
            barGap={8}
            barCategoryGap="25%"
            margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#94a3b8" }}
              axisLine={{ stroke: "#334155" }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "#94a3b8" }}
              axisLine={{ stroke: "#334155" }}
            />
            <Tooltip content={<Tip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
              formatter={(value, entry) =>
                <span className="text-slate-300">{entry.dataKey === "in" ? "รถเข้า (IN)" : "รถออก (OUT)"}</span>
              }
            />
            {/* เขียว = เข้า */}
            <Bar
              dataKey="in"
              name="รถเข้า (IN)"
              fill="#10b981"
              radius={[8, 8, 0, 0]}
            />
            {/* แดง = ออก */}
            <Bar
              dataKey="out"
              name="รถออก (OUT)"
              fill="#f43f5e"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
