// src/components/PlateEditor.jsx
import { useEffect, useState } from "react";
import ProvinceAutocomplete from "./ProvinceAutocomplete";

/**
 * Inline plate / province editing component.
 *
 * Props:
 *  - eventId        {string|number|null}  Event ID for single-event PATCH
 *  - sessionId      {string|number|null}  Session ID for session fix-plate endpoint
 *  - currentPlate   {string}              Current plate value
 *  - currentProvince {string}             Current province value
 *  - onSaved        {function}            Called with ({ eventId, sessionId }, updatedFields)
 *  - apiBaseUrl     {string}              Base URL for the API
 *  - personUI       {object}              Person type UI descriptor (optional, for status display)
 *  - memberName     {string|null}         Member name to display (optional)
 */
export default function PlateEditor({
  eventId = null,
  sessionId = null,
  currentPlate = "",
  currentProvince = "",
  onSaved,
  apiBaseUrl,
  personUI = null,
  memberName = null,
}) {
  const [editing, setEditing] = useState(false);
  const [plateInput, setPlateInput] = useState(currentPlate);
  const [provinceInput, setProvinceInput] = useState(currentProvince);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Reset inputs when the record changes
  useEffect(() => {
    setPlateInput(currentPlate || "");
    setProvinceInput(currentProvince || "");
    setErrorMsg("");
    setSuccessMsg("");
    setEditing(false);
  }, [currentPlate, currentProvince, eventId, sessionId]);

  const trimmedPlate = plateInput.trim();
  const trimmedProvince = provinceInput.trim();

  const hasChanged =
    trimmedPlate !== (currentPlate || "").trim() ||
    trimmedProvince !== (currentProvince || "").trim();

  function handleCancel() {
    setPlateInput(currentPlate || "");
    setProvinceInput(currentProvince || "");
    setErrorMsg("");
    setSuccessMsg("");
    setEditing(false);
  }

  async function handleSave() {
    try {
      setErrorMsg("");
      setSuccessMsg("");

      if (!hasChanged) {
        setErrorMsg("ยังไม่มีการเปลี่ยนแปลง");
        return;
      }

      if (!sessionId && !eventId) {
        setErrorMsg("ไม่พบข้อมูลสำหรับบันทึก");
        return;
      }

      setIsSaving(true);

      let url;
      let fetchOptions;
      let isSessionFix = false;

      if (sessionId) {
        // Session fix-plate endpoint still uses query params
        const params = new URLSearchParams();
        if (trimmedPlate) params.set("correct_plate", trimmedPlate);
        if (trimmedProvince) params.set("correct_province", trimmedProvince);

        url = `${apiBaseUrl}/api/parking-sessions/${sessionId}/fix-plate?${params.toString()}`;
        fetchOptions = { method: "PATCH" };
        isSessionFix = true;
      } else if (eventId) {
        // UPDATED: Event PATCH now uses JSON body instead of query params
        url = `${apiBaseUrl}/events/${eventId}`;
        fetchOptions = {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plate: trimmedPlate, province: trimmedProvince }),
        };
      }

      const res = await fetch(url, fetchOptions);

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const json = await res.json().catch(() => null);
      const data = json?.data || json || {};

      const updated = isSessionFix
        ? {
            plate: data.plate_number_entry ?? trimmedPlate ?? currentPlate,
            province: data.province ?? trimmedProvince ?? currentProvince,
            entry_time: data.entry_time,
            exit_time: data.exit_time,
            status: data.status,
          }
        : {
            plate: data.plate ?? trimmedPlate ?? currentPlate,
            province: data.province ?? trimmedProvince ?? currentProvince,
            datetime: data.datetime,
          };

      setSuccessMsg("บันทึกเรียบร้อยแล้ว");
      setEditing(false);
      onSaved?.(
        { eventId: eventId || null, sessionId: sessionId || null },
        updated,
      );
    } catch (err) {
      console.error(err);
      setErrorMsg("บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">
          แก้ไขข้อมูล
        </span>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            แก้ไข
          </button>
        )}
      </div>

      <div className="space-y-3 text-xs">
        {/* ป้ายทะเบียน */}
        <label className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-slate-500">ป้ายทะเบียน</span>
          <input
            type="text"
            value={plateInput}
            onChange={(e) => setPlateInput(e.target.value)}
            disabled={!editing}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:bg-slate-50 disabled:text-slate-500"
            placeholder="เช่น 3กข 1234"
          />
        </label>

        {/* จังหวัด + suggestion */}
        <div className="flex items-start gap-2">
          <span className="w-20 shrink-0 pt-2 text-slate-500">จังหวัด</span>
          {editing ? (
            <ProvinceAutocomplete
              value={provinceInput}
              onChange={setProvinceInput}
            />
          ) : (
            <input
              type="text"
              value={provinceInput}
              disabled
              className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 shadow-sm bg-slate-50"
              placeholder="เลือกจังหวัด"
            />
          )}
        </div>

        {/* สถานะคนใน/คนนอก + ชื่อ (ถ้ามี) */}
        {personUI && (
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-slate-500">สถานะ</span>
            <div className="flex flex-col gap-0.5">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${personUI.chipClass}`}
              >
                {personUI.label}
              </span>
              {personUI.type === "inside" && memberName && (
                <span className="text-[11px] text-slate-500">
                  {memberName}
                </span>
              )}
            </div>
          </div>
        )}

        {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
        {successMsg && (
          <p className="text-xs text-emerald-600">{successMsg}</p>
        )}
      </div>

      {editing && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
          </button>
        </div>
      )}
    </div>
  );
}
