import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// ===== CONFIG API =====
const API = (
  import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// รายชื่อจังหวัดไทย (ปรับเพิ่ม/ลดได้)
const THAI_PROVINCES = [
  "กรุงเทพมหานคร",
  "กระบี่",
  "กาญจนบุรี",
  "กาฬสินธุ์",
  "กำแพงเพชร",
  "ขอนแก่น",
  "จันทบุรี",
  "ฉะเชิงเทรา",
  "ชลบุรี",
  "ชัยนาท",
  "ชัยภูมิ",
  "ชุมพร",
  "เชียงราย",
  "เชียงใหม่",
  "ตรัง",
  "ตราด",
  "ตาก",
  "นครนายก",
  "นครปฐม",
  "นครพนม",
  "นครราชสีมา",
  "นครศรีธรรมราช",
  "นครสวรรค์",
  "นนทบุรี",
  "นราธิวาส",
  "น่าน",
  "บึงกาฬ",
  "บุรีรัมย์",
  "ปทุมธานี",
  "ประจวบคีรีขันธ์",
  "ปราจีนบุรี",
  "ปัตตานี",
  "พระนครศรีอยุธยา",
  "พังงา",
  "พัทลุง",
  "พิจิตร",
  "พิษณุโลก",
  "เพชรบุรี",
  "เพชรบูรณ์",
  "แพร่",
  "ภูเก็ต",
  "มหาสารคาม",
  "มุกดาหาร",
  "แม่ฮ่องสอน",
  "ยโสธร",
  "ยะลา",
  "ร้อยเอ็ด",
  "ระนอง",
  "ระยอง",
  "ราชบุรี",
  "ลพบุรี",
  "ลำปาง",
  "ลำพูน",
  "เลย",
  "ศรีสะเกษ",
  "สกลนคร",
  "สงขลา",
  "สตูล",
  "สมุทรปราการ",
  "สมุทรสงคราม",
  "สมุทรสาคร",
  "สระแก้ว",
  "สระบุรี",
  "สิงห์บุรี",
  "สุโขทัย",
  "สุพรรณบุรี",
  "สุราษฎร์ธานี",
  "สุรินทร์",
  "หนองคาย",
  "หนองบัวลำภู",
  "อ่างทอง",
  "อำนาจเจริญ",
  "อุดรธานี",
  "อุตรดิตถ์",
  "อุทัยธานี",
  "อุบลราชธานี",
];

// ===== helpers =====

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

// helper ดูทิศทางจากข้อมูลดิบ
function getDirection(rec = {}) {
  const raw = (rec._raw?.direction || rec.direction || "")
    .toString()
    .toUpperCase();
  const status = (rec.status || rec._raw?.status || "").toString();
  if (raw === "IN" || status.includes("เข้า")) return "IN";
  if (raw === "OUT" || status.includes("ออก")) return "OUT";
  return "UNKNOWN";
}

// helper label/สีสำหรับทิศทาง
function getDirectionUI(rec = {}) {
  const dir = getDirection(rec);
  if (dir === "IN") {
    return {
      label: "เข้า (IN)",
      chipClass: "bg-sky-100 text-sky-700 border border-sky-200",
      cardBg: "bg-sky-500",
    };
  }
  if (dir === "OUT") {
    return {
      label: "ออก (OUT)",
      chipClass: "bg-amber-100 text-amber-700 border border-amber-200",
      cardBg: "bg-amber-500",
    };
  }
  return {
    label: "ไม่ทราบ",
    chipClass: "bg-slate-100 text-slate-700 border border-slate-200",
    cardBg: "bg-slate-500",
  };
}

// helper สีสำหรับบุคคลภายใน/ภายนอก
function getPersonTypeUI(rec = {}) {
  const val = rec.check || rec._raw?.check || "";

  if (val === "บุคคลภายใน") {
    return {
      label: "บุคคลภายใน",
      chipClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    };
  }

  if (val === "บุคคลภายนอก") {
    return {
      label: "บุคคลภายนอก",
      chipClass: "bg-rose-50 text-rose-700 border border-rose-200",
    };
  }

  return {
    label: val || "-",
    chipClass: "bg-slate-50 text-slate-600 border border-slate-200",
  };
}

function InfoRow({ label, value }) {
  return (
    <p className="flex gap-2">
      <span className="w-24 shrink-0 text-xs font-medium text-slate-500">
        {label}
      </span>
      <span className="text-sm text-slate-800">{value || "-"}</span>
    </p>
  );
}

// ดึง event_id จาก record/_raw
function getEventId(rec = {}) {
  return rec._raw?.event_id ?? rec._raw?.id ?? rec.event_id ?? rec.id ?? null;
}

// ===== Modal Portal ให้ render ไปที่ document.body =====
function ModalPortal({ children }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

// ===== Modal รายละเอียด (แก้ป้ายทะเบียน + จังหวัดได้) =====
function DetailModal({ record, onClose, onUpdated }) {
  const [showFullImage, setShowFullImage] = useState(false);
  const [plateInput, setPlateInput] = useState("");
  const [provinceInput, setProvinceInput] = useState("");
  const [showProvinceList, setShowProvinceList] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const imgUrl = getImageUrl(record);
  const dirUI = getDirectionUI(record);
  const personUI = getPersonTypeUI(record); // ✅ ใช้ record ไม่ใช่ rec

  const rawPlate =
    record._raw?.plate ?? record.plate ?? record._raw?.license_plate ?? "";
  const rawProvince = record._raw?.province ?? record.province ?? "";

  const time = record.time || record._raw?.time || record._raw?.datetime || "-";

  const name =
    record.member_name ||
    record._raw?.member_name ||
    record._raw?.driver_name ||
    record._raw?.owner_name ||
    "ไม่ทราบชื่อ";

  const status = record.check || record.status || record._raw?.check || "-";

  // init form เมื่อเปิด modal
  useEffect(() => {
    setPlateInput(rawPlate || "");
    setProvinceInput(rawProvince || "");
    setErrorMsg("");
    setSuccessMsg("");
  }, [rawPlate, rawProvince]);

  const filteredProvinces = THAI_PROVINCES.filter((p) =>
    p.toLowerCase().includes(provinceInput.toLowerCase())
  ).slice(0, 10);

  const eventId = getEventId(record);

  const hasChanged =
    plateInput.trim() !== (rawPlate || "") ||
    provinceInput.trim() !== (rawProvince || "");

  async function handleSave() {
    try {
      setErrorMsg("");
      setSuccessMsg("");

      if (!hasChanged) {
        setErrorMsg("ยังไม่มีการเปลี่ยนแปลง");
        return;
      }

      if (!eventId) {
        setErrorMsg("ไม่พบรหัส Event สำหรับบันทึก");
        return;
      }

      const newPlate = plateInput.trim();
      const newProvince = provinceInput.trim();

      const params = new URLSearchParams();
      if (newPlate !== (rawPlate || "")) params.set("plate", newPlate);
      if (newProvince !== (rawProvince || ""))
        params.set("province", newProvince);

      if (![...params.keys()].length) {
        setErrorMsg("ยังไม่มีฟิลด์ที่ต้องการแก้ไข");
        return;
      }

      setIsSaving(true);

      const url = `${API}/events/${eventId}?${params.toString()}`;
      const res = await fetch(url, { method: "PATCH" });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const json = await res.json().catch(() => null);
      const data = json?.data || json || {};

      const updated = {
        plate: data.plate ?? newPlate ?? rawPlate,
        province: data.province ?? newProvince ?? rawProvince,
        datetime: data.datetime ?? record._raw?.datetime,
      };

      setSuccessMsg("บันทึกเรียบร้อยแล้ว");
      onUpdated?.(eventId, updated);
    } catch (err) {
      console.error(err);
      setErrorMsg("บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      {/* main detail modal */}
      <div
        className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <div
          className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <header className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              รายละเอียดการเข้า-ออก
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <span className="sr-only">Close</span>×
            </button>
          </header>

          {/* body */}
          <div className="flex flex-col gap-4 p-6 md:flex-row">
            {/* รูป */}
            <div className="md:w-1/2">
              {imgUrl ? (
                <button
                  type="button"
                  onClick={() => setShowFullImage(true)}
                  className="block w-full overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                  title="คลิกเพื่อดูรูปเต็มจอ"
                >
                  <img
                    src={imgUrl}
                    alt={rawPlate}
                    className="h-72 w-full cursor-zoom-in object-cover"
                  />
                </button>
              ) : (
                <div className="flex h-72 w-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
                  ไม่มีรูปภาพ
                </div>
              )}
            </div>

            {/* รายละเอียด + ฟอร์มแก้ไข */}
            <div className="flex flex-1 flex-col gap-3 text-sm md:w-1/2">
              <InfoRow label="เวลา" value={time} />

              {/* ป้ายทะเบียน (แก้ไขได้) */}
              <label className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs font-medium text-slate-500">
                  ป้ายทะเบียน
                </span>
                <input
                  type="text"
                  value={plateInput}
                  onChange={(e) => setPlateInput(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="เช่น 2กท 1234"
                />
              </label>

              {/* จังหวัด (input + dropdown แนะนำ) */}
              <div className="flex items-start gap-2">
                <span className="w-24 shrink-0 pt-2 text-xs font-medium text-slate-500">
                  จังหวัด
                </span>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={provinceInput}
                    onChange={(e) => {
                      setProvinceInput(e.target.value);
                      setShowProvinceList(true);
                    }}
                    onFocus={() => setShowProvinceList(true)}
                    onBlur={() => {
                      // หน่วงนิดนึงให้คลิกที่รายการได้
                      setTimeout(() => setShowProvinceList(false), 150);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    placeholder="พิมพ์ชื่อจังหวัด..."
                  />
                  {showProvinceList && filteredProvinces.length > 0 && (
                    <ul className="absolute z-[1300] mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow-lg">
                      {filteredProvinces.map((p) => (
                        <li key={p}>
                          <button
                            type="button"
                            className="w-full px-3 py-1.5 text-left text-slate-800 hover:bg-sky-50"
                            onClick={() => {
                              setProvinceInput(p);
                              setShowProvinceList(false);
                            }}
                          >
                            {p}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <InfoRow label="ชื่อ" value={name} />

              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs font-medium text-slate-500">
                  ทิศทาง
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${dirUI.chipClass}`}
                >
                  {dirUI.label}
                </span>
              </div>

              {/* แสดงสถานะเป็น chip สี บุคคลภายใน/ภายนอก */}
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs font-medium text-slate-500">
                  สถานะ
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${personUI.chipClass}`}
                >
                  {personUI.label || status}
                </span>
              </div>

              {errorMsg && (
                <p className="mt-1 text-xs text-red-600">{errorMsg}</p>
              )}
              {successMsg && (
                <p className="mt-1 text-xs text-emerald-600">{successMsg}</p>
              )}
            </div>
          </div>

          {/* footer ปุ่มบันทึก/ปิด */}
          <footer className="flex items-center justify-end gap-2 border-t px-6 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              ปิด
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !hasChanged}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white ${
                isSaving || !hasChanged
                  ? "bg-sky-300"
                  : "bg-sky-600 hover:bg-sky-700"
              }`}
            >
              {isSaving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </button>
          </footer>
        </div>
      </div>

      {/* full-screen image viewer */}
      {showFullImage && imgUrl && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/90 px-4"
            onClick={() => setShowFullImage(false)}
          >
            <div className="relative max-h-[95vh] max-w-[95vw]">
              <img
                src={imgUrl}
                alt={rawPlate}
                className="max-h-[95vh] max-w-[95vw] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                onClick={() => setShowFullImage(false)}
                className="absolute -right-3 -top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
              >
                ×
              </button>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}

function Th({ children }) {
  return (
    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function Td({ children }) {
  return (
    <td className="whitespace-nowrap px-3 py-2 text-slate-800">{children}</td>
  );
}


// ===== main table =====
export default function RecordsTable({ records = [] }) {
  const [selected, setSelected] = useState(null);
  const [rows, setRows] = useState(Array.isArray(records) ? records : []);
  const [currentPage, setCurrentPage] = useState(1);

  // sync rows กับ props records
  useEffect(() => {
    setRows(Array.isArray(records) ? records : []);
    setCurrentPage(1); // เปลี่ยนชุดข้อมูลใหม่ กลับไปหน้า 1 เสมอ
  }, [records]);

  if (!Array.isArray(rows) || rows.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-slate-500">
        ไม่พบข้อมูล
      </div>
    );
  }

  // ===== pagination config =====
  const PAGE_SIZE = 10; // แสดง 10 รายการต่อหน้า
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const pageRows = rows.slice(startIndex, endIndex);

  // สร้างเลขหน้าที่จะแสดง เช่น 1 2 3 4 5 (เลื่อนไปตาม currentPage)
  function getPageNumbers(current, total, maxButtons = 5) {
    const pages = [];
    if (total <= maxButtons) {
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }

    let start = Math.max(1, current - 2);
    let end = Math.min(total, current + 2);

    if (start === 1) {
      end = Math.min(total, start + maxButtons - 1);
    } else if (end === total) {
      start = Math.max(1, end - maxButtons - 1);
    }

    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  const pageNumbers = getPageNumbers(safePage, totalPages);

  // อัปเดตข้อมูลในตารางหลังบันทึกสำเร็จ
  const handleRecordUpdated = (eventId, updated) => {
    setRows((prev) =>
      prev.map((rec) => {
        const id = getEventId(rec);
        if (id !== eventId) return rec;

        const newRaw = { ...(rec._raw || {}), ...updated };

        // กรณีบางหน้า plate แยกจังหวัด กับบางหน้า plate รวมจังหวัดไว้แล้ว
        let displayPlate = rec.plate;
        let displayProvince = rec.province;

        if (typeof updated.plate !== "undefined") {
          if (rec.plate && rec.plate.includes("จ.") && !rec.province) {
            // style ของ Dashboard ที่รวม "จ.จังหวัด" ไว้ใน plate
            const prov = updated.province ?? newRaw.province ?? "";
            displayPlate = updated.plate || "";
            if (prov) displayPlate += ` จ.${prov}`;
          } else {
            displayPlate = updated.plate;
          }
        }

        if (typeof updated.province !== "undefined") {
          displayProvince = updated.province;
          if (rec.plate && rec.plate.includes("จ.") && !rec.province) {
            const plt = updated.plate ?? newRaw.plate ?? "";
            if (updated.province) {
              displayPlate = `${plt} จ.${updated.province}`;
            }
          }
        }

        return {
          ...rec,
          plate: displayPlate ?? rec.plate,
          province: displayProvince ?? rec.province,
          _raw: newRaw,
        };
      })
    );

    // sync selected record ด้วย
    setSelected((prev) => {
      if (!prev) return prev;
      const id = getEventId(prev);
      if (id !== eventId) return prev;
      const newRaw = { ...(prev._raw || {}), ...updated };
      return {
        ...prev,
        plate: updated.plate ?? prev.plate,
        province: updated.province ?? prev.province,
        _raw: newRaw,
      };
    });
  };

  return (
    <>
      <div className="overflow-x-auto bg-white">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <Th>เวลา</Th>
              <Th>ป้ายทะเบียน</Th>
              <Th>จังหวัด</Th>
              <Th>ทิศทาง</Th>
              <Th>สถานะ</Th>
              <Th>ภาพ</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((rec, idx) => {
              const key =
                rec._raw?.id ||
                rec._raw?._id ||
                `${rec.time || ""}-${rec.plate || ""}-${startIndex + idx}`;
              const imgUrl = getImageUrl(rec);
              const dirUI = getDirectionUI(rec);
              const personUI = getPersonTypeUI(rec);

              return (
                <tr
                  key={key}
                  className="cursor-pointer hover:bg-sky-50"
                  onClick={() => setSelected(rec)}
                >
                  <Td>{rec.time || rec._raw?.time || "-"}</Td>
                  <Td>{rec.plate || rec._raw?.plate || "-"}</Td>
                  <Td>{rec.province || rec._raw?.province || "-"}</Td>

                  {/* ทิศทาง */}
                  <Td>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${dirUI.chipClass}`}
                    >
                      {dirUI.label}
                    </span>
                  </Td>

                  {/* บุคคลภายใน/ภายนอก */}
                  <Td>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${personUI.chipClass}`}
                    >
                      {personUI.label}
                    </span>
                  </Td>

                  {/* รูปภาพ */}
                  <Td>
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={rec.plate || ""}
                        className="h-10 w-16 rounded-md object-cover"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* แถบเปลี่ยนหน้า */}
      <div className="flex flex-col items-center justify-between gap-2 border-t bg-white px-4 py-3 text-xs text-slate-600 sm:flex-row">
        <div>
          แสดง{" "}
          {totalItems === 0 ? 0 : startIndex + 1}-
          {Math.min(endIndex, totalItems)} จาก {totalItems} รายการ (หน้า{" "}
          {safePage}/{totalPages})
        </div>

        <div className="inline-flex items-center gap-1">
          {/* หน้าแรก / ก่อนหน้า */}
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            disabled={safePage === 1}
            className="rounded border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-100"
          >
            «
          </button>
          <button
            type="button"
            onClick={() =>
              setCurrentPage((p) => Math.max(1, p - 1))
            }
            disabled={safePage === 1}
            className="rounded border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-100"
          >
            ‹
          </button>

          {/* เลขหน้า 1 2 3 4 ... */}
          {pageNumbers.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setCurrentPage(page)}
              className={`min-w-[2rem] rounded border px-2 py-1 text-center ${
                page === safePage
                  ? "border-sky-500 bg-sky-500 text-white"
                  : "border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {page}
            </button>
          ))}

          {/* ถัดไป / หน้าสุดท้าย */}
          <button
            type="button"
            onClick={() =>
              setCurrentPage((p) => Math.min(totalPages, p + 1))
            }
            disabled={safePage === totalPages}
            className="rounded border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-100"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage(totalPages)}
            disabled={safePage === totalPages}
            className="rounded border border-slate-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-100"
          >
            »
          </button>
        </div>
      </div>

      {selected && (
        <ModalPortal>
          <DetailModal
            record={selected}
            onClose={() => setSelected(null)}
            onUpdated={handleRecordUpdated}
          />
        </ModalPortal>
      )}
    </>
  );
}
