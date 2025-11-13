import { useEffect, useMemo, useState } from "react";

export default function RecordsTable({ records = [], pageSize = 10 }) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const startIndex = (page - 1) * pageSize;

  useEffect(() => {
    // ถ้าข้อมูลเปลี่ยนจนหน้าปัจจุบันเกินขอบเขต ให้เด้งกลับหน้า 1
    if (page > totalPages) setPage(1);
  }, [records, pageSize, totalPages, page]);

  const rows = useMemo(
    () => records.slice(startIndex, startIndex + pageSize),
    [records, startIndex, pageSize]
  );

  const goto = (p) => setPage(Math.min(Math.max(1, p), totalPages));

  // สร้างหน้าต่างเลขหน้า (แสดงรอบ ๆ หน้าปัจจุบัน)
  const windowSize = 2; // current ±2
  let start = Math.max(1, page - windowSize);
  let end = Math.min(totalPages, page + windowSize);
  if (end - start < windowSize * 2) {
    if (start === 1) end = Math.min(totalPages, start + windowSize * 2);
    else if (end === totalPages) start = Math.max(1, end - windowSize * 2);
  }
  const pageNums = [];
  for (let p = start; p <= end; p++) pageNums.push(p);

  return (
    <div>
      <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
        <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-3">เวลา</th>
              <th className="px-3 py-3">ทะเบียน</th>
              <th className="px-3 py-3">ทิศทาง</th>
              <th className="px-3 py-3">สถานะ</th>
              <th className="px-3 py-3">ภาพ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => (
              <tr
                key={`${startIndex + i}-${r.time}-${r.plate}-${r.imgUrl || i}`}
                className="hover:bg-slate-50/70"
              >
                <td className="px-3 py-2">{r.time || "-"}</td>

                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <span>{r.plate || "-"}</span>
                    <span className="text-xs text-slate-500">{r.province || "-"}</span>
                  </div>
                </td>

                <td className="px-3 py-2">
                  <span
                    className={[
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      r.status === "เข้า"
                        ? "bg-emerald-100 text-emerald-700"
                        : r.status === "ออก"
                        ? "bg-slate-100 text-slate-700"
                        : "bg-gray-100 text-gray-700",
                    ].join(" ")}
                  >
                    {r.status || "-"}
                  </span>
                </td>

                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      (r.check || "").includes("ภายใน")
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {r.check || "-"}
                  </span>
                </td>

                <td className="px-3 py-2">
                  {r.imgUrl ? (
                    <img
                      src={r.imgUrl}
                      alt={r.plate || "plate"}
                      className="h-12 w-16 object-cover rounded-md ring-1 ring-slate-200"
                    />
                  ) : (
                    <span className="text-slate-400 text-sm">—</span>
                  )}
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  ไม่พบข้อมูลในหน้านี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          แสดง{" "}
          <span className="font-medium">
            {records.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + pageSize, records.length)}
          </span>{" "}
          จาก <span className="font-medium">{records.length}</span> รายการ
        </div>

        <nav className="flex items-center gap-1">
          <button
            onClick={() => goto(1)}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-md ring-1 ring-slate-300 text-sm disabled:opacity-50 hover:bg-slate-50"
          >
            หน้าแรก
          </button>
          <button
            onClick={() => goto(page - 1)}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-md ring-1 ring-slate-300 text-sm disabled:opacity-50 hover:bg-slate-50"
          >
            ก่อนหน้า
          </button>

          {start > 1 && (
            <>
              <button
                onClick={() => goto(1)}
                className={`px-3 py-1.5 rounded-md ring-1 ring-slate-300 text-sm hover:bg-slate-50 ${
                  page === 1 ? "bg-slate-900 text-white" : ""
                }`}
              >
                1
              </button>
              {start > 2 && <span className="px-1 text-slate-500">…</span>}
            </>
          )}

          {pageNums.map((p) => (
            <button
              key={p}
              onClick={() => goto(p)}
              className={`px-3 py-1.5 rounded-md ring-1 ring-slate-300 text-sm hover:bg-slate-50 ${
                page === p ? "bg-slate-900 text-white" : ""
              }`}
            >
              {p}
            </button>
          ))}

          {end < totalPages && (
            <>
              {end < totalPages - 1 && <span className="px-1 text-slate-500">…</span>}
              <button
                onClick={() => goto(totalPages)}
                className={`px-3 py-1.5 rounded-md ring-1 ring-slate-300 text-sm hover:bg-slate-50 ${
                  page === totalPages ? "bg-slate-900 text-white" : ""
                }`}
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            onClick={() => goto(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-md ring-1 ring-slate-300 text-sm disabled:opacity-50 hover:bg-slate-50"
          >
            ถัดไป
          </button>
          <button
            onClick={() => goto(totalPages)}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-md ring-1 ring-slate-300 text-sm disabled:opacity-50 hover:bg-slate-50"
          >
            หน้าสุดท้าย
          </button>
        </nav>
      </div>
    </div>
  );
}
