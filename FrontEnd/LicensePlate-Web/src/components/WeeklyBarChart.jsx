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
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow">
      <div className="text-xs font-semibold text-slate-700">{label}</div>
      <div className="mt-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#22c55e]" />
          รถเข้า (IN): <b className="ml-1">{pIn}</b>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#ef4444]" />
          รถออก (OUT): <b className="ml-1">{pOut}</b>
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
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#475569" }}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "#475569" }}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <Tooltip content={<Tip />} />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value, entry) =>
                entry.dataKey === "in" ? "รถเข้า (IN)" : "รถออก (OUT)"
              }
            />
            {/* เขียว = เข้า */}
            <Bar
              dataKey="in"
              name="รถเข้า (IN)"
              fill="#22c55e"
              radius={[8, 8, 0, 0]}
            />
            {/* แดง = ออก */}
            <Bar
              dataKey="out"
              name="รถออก (OUT)"
              fill="#ef4444"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
