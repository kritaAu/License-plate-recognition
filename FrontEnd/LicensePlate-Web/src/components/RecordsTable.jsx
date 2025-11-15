// src/components/RecordsTable.jsx
import { useEffect, useMemo, useState } from "react";

/* ---------- helpers ---------- */
function getImageUrl(rec = {}) {
  return (
    rec.imgUrl ||
    rec.image ||
    rec.blob ||
    rec._raw?.imgUrl ||
    rec._raw?.image ||
    rec._raw?.blob ||
    null
  );
}

function getDirection(rec = {}) {
  const raw = (rec._raw?.direction || rec.direction || "").toString().toUpperCase();
  const status = (rec.status || "").toString();
  if (raw === "IN" || status.includes("เข้า")) return "IN";
  if (raw === "OUT" || status.includes("ออก")) return "OUT";
  return "UNKNOWN";
}

function getPaginationRange(current, totalPages, siblings = 1) {
  const totalNumbers = siblings * 2 + 5; // 1 ... [range] ... N
  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const left = Math.max(2, current - siblings);
  const right = Math.min(totalPages - 1, current + siblings);
  const showLeftDots = left > 2;
  const showRightDots = right < totalPages - 1;

  const range = [1];
  if (showLeftDots) range.push("...");
  for (let i = left; i <= right; i++) range.push(i);
  if (showRightDots) range.push("...");
  range.push(totalPages);
  return range;
}

/* ตัด "จ.จังหวัด" ออกจากสตริงทะเบียน (กันกรณีฝั่งอื่นเผลอต่อมา) */
function onlyPlate(plateStr) {
  const s = String(plateStr || "").replace(/\s{2,}/g, " ").trim();
  const i = s.indexOf("จ.");
  return (i >= 0 ? s.slice(0, i) : s).trim();
}

/* ช่วย normalize ป้ายทะเบียน/จังหวัด */
const normalize = (s) => String(s || "").replace(/\s+/g, "").toUpperCase();

/* ดึงชื่อจาก payload ที่มีอยู่ (flatten + nested) ถ้ามี */
function extractNameFromRaw(raw = {}) {
  let vehicle = raw.Vehicle || raw.vehicle || {};
  if (Array.isArray(vehicle)) vehicle = vehicle[0] || {};
  let member = vehicle.member || raw.member || {};
  if (Array.isArray(member)) member = member[0] || {};

  return (
    raw.driver_name ||
    raw.member_name ||
    raw.owner_name ||
    raw.full_name ||
    raw.name ||
    member.full_name ||
    member.name ||
    member.display_name ||
    ""
  );
}

/* ---------- component ---------- */
const API = (import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export default function RecordsTable({ records = [] }) {
  const PAGE_SIZE = 10;

  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  // ชื่อที่โหลดแบบ on-demand เมื่อต้องการ
  const [personName, setPersonName] = useState("");
  const [personLoading, setPersonLoading] = useState(false);

  // รีเซ็ตไปหน้า 1 เมื่อมีการเปลี่ยนชุดข้อมูล
  useEffect(() => {
    setPage(1);
  }, [records]);

  const pageCount = Math.max(1, Math.ceil(records.length / PAGE_SIZE));

  const currentRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return records.slice(start, start + PAGE_SIZE);
  }, [records, page]);

  function openDetail(rec) {
    setSelected(rec);
    setPersonName("");
    setPersonLoading(false);

    // ถ้าเป็นบุคคลภายในแต่ payload ไม่มีชื่อ -> ดึงจาก /members on-demand
    const isInside = (rec.check || "").includes("ภายใน");
    const rawName = extractNameFromRaw(rec._raw || {});
    if (isInside && !rawName) {
      fetchMemberName(rec);
    }
  }

  function closeDetail() {
    setSelected(null);
    setPersonName("");
    setPersonLoading(false);
  }

  async function fetchMemberName(rec) {
    try {
      setPersonLoading(true);

      // ใช้ทะเบียนแบบ "ไม่พ่วงจังหวัด"
      const plate = onlyPlate(String(rec.plate || "")).trim();
      const province = (rec._raw?.province || rec.province || "").trim();

      const url = new URL(`${API}/members`);
      if (plate) url.searchParams.set("plate", plate);
      // เผื่อ backend รองรับ province ให้แนบไปด้วย
      if (province) url.searchParams.set("province", province);

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error("fetch members failed");
      const list = (await res.json()) || [];

      // เลือก record ที่แมตช์ที่สุดจาก plate (+ province ถ้าได้)
      const nPlate = normalize(plate);
      const nProv = normalize(province);

      let best =
        list.find(
          (m) =>
            normalize(m.plate) === nPlate &&
            (!nProv || normalize(m.province) === nProv)
        ) ||
        list.find((m) => normalize(m.plate) === nPlate) ||
        list[0];

      const name =
        best?.full_name ||
        best?.name ||
        (best?.firstname && best?.lastname ? `${best.firstname} ${best.lastname}` : "") ||
        best?.display_name ||
        "";

      setPersonName(name || "ไม่ทราบชื่อ");
    } catch {
      setPersonName("ไม่ทราบชื่อ");
    } finally {
      setPersonLoading(false);
    }
  }

  return (
    <>
      {/* ตาราง */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 text-left">เวลา</th>
              <th className="px-4 py-3 text-left">ทะเบียน</th>
              <th className="px-4 py-3 text-left">จังหวัด</th>
              <th className="px-4 py-3 text-center">ทิศทาง</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
              <th className="px-4 py-3 text-center">ภาพ</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {currentRows.map((rec, idx) => {
              const imgUrl = getImageUrl(rec);
              const dir = getDirection(rec);
              const isInside = (rec.check || "").includes("ภายใน");
              const province = rec._raw?.province || rec.province || "-";

              return (
                <tr
                  key={rec.id || rec._raw?.id || `${rec.time}-${idx}`}
                  onClick={() => openDetail(rec)}
                  className="cursor-pointer hover:bg-sky-50/70 transition-colors"
                >
                  {/* เวลา */}
                  <td className="px-4 py-3 whitespace-nowrap text-slate-800">
                    {rec.time || "-"}
                  </td>

                  {/* ทะเบียน (ตัด จ.จังหวัด ออก) */}
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">
                      {onlyPlate(rec.plate) || "-"}
                    </span>
                  </td>

                  {/* จังหวัด */}
                  <td className="px-4 py-3">
                    <span className="text-slate-800">{province}</span>
                  </td>

                  {/* ทิศทาง */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium " +
                        (dir === "IN"
                          ? "bg-emerald-50 text-emerald-700"
                          : dir === "OUT"
                          ? "bg-slate-50 text-slate-700"
                          : "bg-slate-100 text-slate-600")
                      }
                    >
                      {rec.status || (dir === "IN" ? "เข้า" : dir === "OUT" ? "ออก" : "-")}
                    </span>
                  </td>

                  {/* คนใน/คนนอก */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium " +
                        (isInside ? "bg-indigo-50 text-indigo-700" : "bg-rose-50 text-rose-700")
                      }
                    >
                      {rec.check || (isInside ? "บุคคลภายใน" : "บุคคลภายนอก")}
                    </span>
                  </td>

                  {/* ภาพ */}
                  <td className="px-4 py-3 text-center">
                    {imgUrl ? (
                      <div className="inline-flex h-12 w-16 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <img src={imgUrl} className="h-full w-full object-cover" loading="lazy" />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">ไม่มีภาพ</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {currentRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                  ไม่พบข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* แถบเลขหน้า */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:opacity-50"
          disabled={page === 1}
          onClick={() => setPage(1)}
        >
          หน้าแรก
        </button>

        <button
          className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:opacity-50"
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ก่อนหน้า
        </button>

        {getPaginationRange(page, pageCount, 1).map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} className="inline-flex h-9 items-center px-2 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={`p-${p}`}
              onClick={() => setPage(p)}
              aria-current={p === page ? "page" : undefined}
              className={
                "inline-flex h-9 min-w-[36px] items-center justify-center rounded-lg border px-2 text-sm transition " +
                (p === page
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
              }
            >
              {p}
            </button>
          )
        )}

        <button
          className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:opacity-50"
          disabled={page >= pageCount}
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
        >
          ถัดไป
        </button>

        <button
          className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:opacity-50"
          disabled={page >= pageCount}
          onClick={() => setPage(pageCount)}
        >
          หน้าสุดท้าย
        </button>
      </div>

      {/* Modal รายละเอียด */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/40 overflow-y-auto"
          onClick={closeDetail}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex min-h-full items-center justify-center px-3 py-8" onClick={(e) => e.stopPropagation()}>
            <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="text-base font-semibold text-slate-900">รายละเอียดการเข้า-ออก</h2>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              <div className="px-6 py-5">
                <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1.4fr)] items-start">
                  {/* ซ้าย: รูป */}
                  <div className="flex items-center justify-center">
                    {getImageUrl(selected) ? (
                      <div className="aspect-square w-full max-w-sm rounded-3xl overflow-hidden bg-slate-100 flex items-center justify-center">
                        <img
                          src={getImageUrl(selected)}
                          alt="ภาพจากกล้อง"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square w-full max-w-sm rounded-3xl bg-slate-200 flex items-center justify-center">
                        <span className="text-xl font-semibold text-slate-600">
                          {onlyPlate(selected.plate) || "ไม่มีภาพ"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ขวา: ข้อมูล */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-slate-500">เวลา</p>
                      <p className="mt-1 text-sm text-slate-900">{selected.time || "-"}</p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-slate-500">ป้ายทะเบียน</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {onlyPlate(selected.plate) || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-slate-500">จังหวัด</p>
                      <p className="mt-1 text-sm text-slate-900">
                        {selected._raw?.province || selected.province || "-"}
                      </p>
                    </div>

                    {/* ===== ชื่อผู้ใช้ ===== */}
                    {(() => {
                      const isInside = (selected.check || "").includes("ภายใน");
                      const rawName = extractNameFromRaw(selected._raw || {});
                      const nameToShow = rawName || personName || (personLoading ? "กำลังโหลดชื่อ..." : "ไม่ทราบชื่อ");

                      return (
                        <div>
                          <p className="text-xs font-medium text-slate-500">ชื่อ</p>
                          <p className="mt-1 text-sm text-slate-900">
                            {isInside ? nameToShow : "ไม่ทราบชื่อ"}
                          </p>
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium text-slate-500">ทิศทาง</p>
                        <p className="mt-1 text-sm">{selected.status || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">สถานะ</p>
                        <p className="mt-1 text-sm">{selected.check || "-"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
