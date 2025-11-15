// src/components/RecordsTable.jsx
import { useState } from "react";

// helper ดึง URL รูปจาก record
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

// helper ดูทิศทาง
function getDirection(rec = {}) {
  const raw = (rec._raw?.direction || rec.direction || "")
    .toString()
    .toUpperCase();
  const status = rec.status || "";
  if (raw === "IN" || status.includes("เข้า")) return "IN";
  if (raw === "OUT" || status.includes("ออก")) return "OUT";
  return "UNKNOWN";
}

// helper label/สีสำหรับทิศทาง
function getDirectionUI(rec = {}) {
  const dir = getDirection(rec);
  if (dir === "IN") {
    return {
      label: "เข้า (In)",
      chipClass: "bg-green-100 text-green-700",
      cardBg: "bg-sky-500",
    };
  }
  if (dir === "OUT") {
    return {
      label: "ออก (Out)",
      chipClass: "bg-rose-100 text-rose-700",
      cardBg: "bg-rose-500",
    };
  }
  return {
    label: "ไม่ทราบ",
    chipClass: "bg-slate-100 text-slate-600",
    cardBg: "bg-slate-400",
  };
}

// helper label/สีสำหรับคนใน/คนนอก
function getPersonUI(rec = {}) {
  const check = rec.check || "";
  const isInside = check.includes("ภายใน");
  return {
    label: isInside ? "บุคคลในระบบ" : "บุคคลภายนอก",
    chipClass: isInside
      ? "bg-indigo-100 text-indigo-700"
      : "bg-slate-100 text-slate-700",
  };
}

export default function RecordsTable({ records = [] }) {
  const [selected, setSelected] = useState(null);

  const openDetail = (rec) => {
    setSelected(rec);
  };

  const closeDetail = () => {
    setSelected(null);
  };

  return (
    <>
      {/* ตารางรายการ */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 text-left">เวลา</th>
              <th className="px-4 py-3 text-left">ทะเบียน</th>
              <th className="px-4 py-3 text-center">ทิศทาง</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
              <th className="px-4 py-3 text-center">ภาพ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {records.map((rec, idx) => {
              const imgUrl = getImageUrl(rec);
              const personInside = (rec.check || "").includes("ภายใน");
              const dir = getDirection(rec);

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

                  {/* ทะเบียน + จังหวัด (ถ้ามี) */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">
                        {rec.plate || "-"}
                      </span>
                      {rec._raw?.province || rec.province ? (
                        <span className="text-xs text-slate-500">
                          {rec._raw?.province || rec.province}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  {/* ทิศทาง */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        dir === "IN"
                          ? "bg-emerald-50 text-emerald-700"
                          : dir === "OUT"
                          ? "bg-slate-50 text-slate-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {rec.status ||
                        (dir === "IN" ? "เข้า" : dir === "OUT" ? "ออก" : "-")}
                    </span>
                  </td>

                  {/* สถานะ (คนใน/คนนอก) */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        personInside
                          ? "bg-indigo-50 text-indigo-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {rec.check ||
                        (personInside ? "บุคคลภายใน" : "บุคคลภายนอก")}
                    </span>
                  </td>

                  {/* ภาพ (thumbnail หรือข้อความ) */}
                  <td className="px-4 py-3 text-center">
                    {imgUrl ? (
                      <div className="inline-flex h-12 w-16 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <img
                          src={imgUrl}
                          alt="ภาพจากกล้อง"
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">ไม่มีภาพ</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {records.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm text-slate-500"
                >
                  ไม่พบข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal รายละเอียด */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto">
          {/* ชั้นนี้ช่วยให้ modal อยู่กลางจอเสมอ (แนวตั้ง + แนวนอน) */}
          <div className="flex min-h-full items-center justify-center px-3 py-8">
            <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
              {/* header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="text-base font-semibold text-slate-900">
                  รายละเอียดการเข้า-ออก
                </h2>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              {/* body */}
              {(() => {
                const imgUrl = getImageUrl(selected);
                const { label: dirLabel, chipClass, cardBg } =
                  getDirectionUI(selected);
                const { label: personLabel, chipClass: personChipClass } =
                  getPersonUI(selected);

                const raw = selected._raw || {};

                // ====== รองรับกรณีที่ข้อมูล Member ซ่อนใน Vehicle.member จาก Supabase ======
                let vehicle = raw.Vehicle || {};
                if (Array.isArray(vehicle)) {
                  vehicle = vehicle[0] || {};
                }
                const member = vehicle.member || {};

                // ดึงชื่อจากหลายแหล่ง: flatten + nested member
                const baseName =
                  raw.driver_name ||
                  raw.member_name ||
                  raw.owner_name ||
                  raw.full_name ||
                  raw.name ||
                  member.full_name ||
                  member.name ||
                  member.display_name ||
                  selected.driver_name ||
                  selected.member_name ||
                  "ไม่ทราบชื่อ";

                // ดึงแผนก / สังกัด (flatten + nested member)
                const dept =
                  raw.member_department ||
                  raw.department ||
                  raw.dept ||
                  member.department ||
                  member.dept ||
                  selected.member_department ||
                  selected.department ||
                  "";

                const displayName = dept ? `${baseName} (${dept})` : baseName;

                const province = raw.province || selected.province || "-";

                return (
                  <div className="px-6 py-5">
                    <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1.4fr)] items-start">
                      {/* ซ้าย: รูป */}
                      <div className="flex items-center justify-center">
                        {imgUrl ? (
                          <div
                            className={`aspect-square w-full max-w-sm rounded-3xl overflow-hidden ${cardBg} flex items-center justify-center`}
                          >
                            {/* eslint-disable-next-line jsx-a11y/alt-text */}
                            <img
                              src={imgUrl}
                              alt="ภาพจากกล้อง"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className={`aspect-square w-full max-w-sm rounded-3xl ${cardBg} flex items-center justify-center`}
                          >
                            <span className="text-xl font-semibold text-white">
                              {selected.plate || "ไม่มีภาพ"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* ขวา: รายละเอียด */}
                      <div className="space-y-3">
                        {/* chip ทิศทาง */}
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${chipClass}`}
                        >
                          {dirLabel}
                        </span>

                        {/* ป้ายทะเบียน */}
                        <div className="mt-1">
                          <p className="text-xs font-medium text-slate-500">
                            ป้ายทะเบียน
                          </p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">
                            {selected.plate || "-"}
                          </p>
                        </div>

                        {/* จังหวัด */}
                        <div className="pt-2">
                          <p className="text-xs font-medium text-slate-500">
                            จังหวัด
                          </p>
                          <p className="mt-1 text-sm text-slate-900">
                            {province}
                          </p>
                        </div>

                        {/* เวลา */}
                        <div className="pt-2">
                          <p className="text-xs font-medium text-slate-500">
                            เวลา
                          </p>
                          <p className="mt-1 text-sm text-slate-900">
                            {selected.time || "-"}
                          </p>
                        </div>

                        {/* ผู้ขับขี่ */}
                        <div className="pt-3 border-t border-slate-100 mt-2">
                          <p className="text-xs font-medium text-slate-500">
                            ผู้ขับขี่
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${personChipClass}`}
                            >
                              {personLabel}
                            </span>
                            <p className="text-sm font-medium text-slate-900">
                              {displayName}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
