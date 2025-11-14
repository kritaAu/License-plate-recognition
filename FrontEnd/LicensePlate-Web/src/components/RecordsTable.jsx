// src/components/RecordsTable.jsx
import { useMemo, useState, useEffect, useCallback } from "react";
import { formatThaiDateTime } from "../utils/date";

/** ================== helpers ================== */
function normalizeDir(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "in" || s === "เข้า") return "IN";
  if (s === "out" || s === "ออก") return "OUT";
  return "";
}
function dirLabel(v) {
  const n = normalizeDir(v);
  if (n === "IN") return "เข้า";
  if (n === "OUT") return "ออก";
  return "ไม่ทราบ";
}
function dirBadgeClass(v) {
  const n = normalizeDir(v);
  if (n === "IN") return "bg-emerald-100 text-emerald-800";
  if (n === "OUT") return "bg-slate-100 text-slate-700";
  return "bg-gray-100 text-gray-700";
}
function personBadgeClass(text) {
  return (text || "").includes("ภายใน")
    ? "bg-emerald-100 text-emerald-800"
    : "bg-rose-100 text-rose-700";
}
/** ตัด “จ.จังหวัด” ออกจากข้อความทะเบียนที่รวมจังหวัดมาในสตริงเดียว */
function basePlateStr(plateStr) {
  if (!plateStr) return "";
  const s = String(plateStr).replace(/\s{2,}/g, " ").trim();
  const i = s.indexOf("จ.");
  return i >= 0 ? s.slice(0, i).trim() : s;
}
/** เพจจิ้งแบบมี … */
function getPaginationRange(current, totalPages, siblings = 1) {
  const totalNumbers = siblings * 2 + 5;
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

/** ================== component ================== */
const API = (import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export default function RecordsTable({ records = [], pageSize = 10 }) {
  const [page, setPage] = useState(1);

  // preview image
  const [previewSrc, setPreviewSrc] = useState(null);
  const [previewAlt, setPreviewAlt] = useState("");

  // modal: person info
  const [personOpen, setPersonOpen] = useState(false);
  const [personLoading, setPersonLoading] = useState(false);
  const [person, setPerson] = useState(null); // {firstname, lastname, std_id, faculty, major, role, plate, province}

  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));

  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [records, page, pageCount]);

  const current = useMemo(() => {
    const start = (page - 1) * pageSize;
    return records.slice(start, start + pageSize);
  }, [records, page, pageSize]);

  const openPreview = useCallback((src, alt = "") => {
    if (!src) return;
    setPreviewSrc(src);
    setPreviewAlt(alt);
  }, []);
  const closePreview = useCallback(() => {
    setPreviewSrc(null);
    setPreviewAlt("");
  }, []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && closePreview();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePreview]);

  /** ดึงข้อมูลสมาชิกจากทะเบียน (เฉพาะบุคคลภายใน) */
  async function openPersonInfo(row) {
    setPerson(null);
    setPersonLoading(true);
    setPersonOpen(true);

    try {
      const plateForQuery = basePlateStr(row.plate);
      const url = new URL(`${API}/members`);
      if (plateForQuery) url.searchParams.set("plate", plateForQuery);
      const res = await fetch(url.toString());
      const list = (await res.json()) || [];

      const normalized = (s) => String(s || "").replace(/\s/g, "");
      let best =
        list.find(
          (m) =>
            normalized(m.plate) === normalized(plateForQuery) &&
            (!row.province || normalized(m.province) === normalized(row.province))
        ) || list[0];

      if (!best) {
        setPerson({ _notFound: true, plate: row.plate, province: row.province });
      } else {
        setPerson(best);
      }
    } catch (e) {
      setPerson({ _error: true });
    } finally {
      setPersonLoading(false);
    }
  }

  return (
    <>
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
            {current.map((r, idx) => {
              const dirRaw = r.direction ?? r.status;
              const isInside = (r.check || "").includes("ภายใน");

              // ✅ ถ้า r.time มีอยู่แล้ว (มาจากหน้า Search ที่ฟอร์แมตแล้ว) ให้ใช้ตรงๆ
              // ถ้าไม่มี ให้ฟอร์แมตจาก r.datetime
              const displayTime = r.time || formatThaiDateTime(r.datetime);
              const imageUrl = r.imgUrl || r.image || null;

              return (
                <tr key={`${displayTime || r.datetime || idx}-${idx}`} className="hover:bg-slate-50/70">
                  <td className="px-3 py-3 align-top whitespace-nowrap">{displayTime || "-"}</td>

                  <td className="px-3 py-3 align-top">
                    <div className="font-medium">{r.plate || "-"}</div>
                    <div className="text-xs text-slate-500">{r.province || "-"}</div>
                  </td>

                  <td className="px-3 py-3 align-top">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${dirBadgeClass(
                        dirRaw
                      )}`}
                    >
                      {dirLabel(dirRaw)}
                    </span>
                  </td>

                  <td className="px-3 py-3 align-top">
                    <button
                      type="button"
                      disabled={!isInside}
                      title={isInside ? "ดูข้อมูลบุคคลภายใน" : undefined}
                      onClick={() => isInside && openPersonInfo(r)}
                      className={
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium " +
                        personBadgeClass(r.check) +
                        (isInside ? " hover:ring-2 hover:ring-emerald-300 transition" : " cursor-default")
                      }
                    >
                      {r.check || "-"}
                    </button>
                  </td>

                  <td className="px-3 py-2 align-top">
                    {imageUrl ? (
                      <button
                        type="button"
                        onClick={() => openPreview(imageUrl, `${r.plate || "-"} ${r.province || ""}`)}
                        className="group block rounded-lg border border-slate-200 overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        title="ดูภาพ"
                      >
                        <img
                          src={imageUrl}
                          alt={`ภาพ: ${r.plate || "-"}`}
                          className="h-16 w-24 object-cover group-hover:opacity-90"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.replaceWith(
                              Object.assign(document.createElement("div"), {
                                className:
                                  "h-16 w-24 flex items-center justify-center text-xs text-slate-500 bg-slate-100",
                                innerText: "โหลดภาพไม่ได้",
                              })
                            );
                          }}
                        />
                      </button>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                        ไม่มีภาพ
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {current.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  ไม่พบข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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

        {getPaginationRange(page, Math.max(1, Math.ceil(records.length / pageSize)), 1).map((p, i) =>
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
          disabled={page >= Math.max(1, Math.ceil(records.length / pageSize))}
          onClick={() => setPage((p) => Math.min(Math.max(1, Math.ceil(records.length / pageSize)), p + 1))}
        >
          ถัดไป
        </button>
        <button
          className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:opacity-50"
          disabled={page >= Math.max(1, Math.ceil(records.length / pageSize))}
          onClick={() => setPage(Math.max(1, Math.ceil(records.length / pageSize)))}
        >
          หน้าสุดท้าย
        </button>
      </div>

      {/* Image preview modal */}
      {previewSrc && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          onClick={closePreview}
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-white text-sm truncate pr-6">{previewAlt}</div>
              <button className="rounded-md bg-white/90 px-3 py-1 text-sm hover:bg-white" onClick={closePreview}>
                ปิด
              </button>
            </div>
            <div className="overflow-hidden rounded-xl bg-black">
              <img src={previewSrc} alt={previewAlt} className="mx-auto max-h-[78vh] w-auto" />
            </div>
          </div>
        </div>
      )}

      {/* Person info modal */}
      {personOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPersonOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">ข้อมูลบุคคลภายใน</h3>
              <button className="rounded-md border px-3 py-1 text-sm" onClick={() => setPersonOpen(false)}>
                ปิด
              </button>
            </div>

            {personLoading && <div className="py-6 text-center text-slate-500">กำลังโหลด…</div>}
            {!personLoading && person?._error && (
              <div className="py-6 text-center text-rose-600">เกิดข้อผิดพลาดในการดึงข้อมูล</div>
            )}
            {!personLoading && person?._notFound && (
              <div className="py-6 text-center text-slate-600">ไม่พบข้อมูลสมาชิกในระบบสำหรับทะเบียนนี้</div>
            )}

            {!personLoading && person && !person._error && !person._notFound && (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-500">ชื่อ-นามสกุล:</span> {person.firstname || "-"} {person.lastname || ""}
                </div>
                {"std_id" in person && (
                  <div>
                    <span className="text-slate-500">รหัสนักศึกษา:</span> {person.std_id ?? "-"}
                  </div>
                )}
                {"faculty" in person && (
                  <div>
                    <span className="text-slate-500">คณะ:</span> {person.faculty || "-"}
                  </div>
                )}
                {"major" in person && (
                  <div>
                    <span className="text-slate-500">สาขา:</span> {person.major || "-"}
                  </div>
                )}
                <div>
                  <span className="text-slate-500">บทบาท:</span> {person.role || "-"}
                </div>
                <div>
                  <span className="text-slate-500">ทะเบียน/จังหวัด:</span> {person.plate || "-"}{" "}
                  {person.province ? `จ.${person.province}` : ""}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
