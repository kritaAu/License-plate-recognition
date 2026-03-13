// src/components/ProvinceAutocomplete.jsx
import { useState } from "react";

/** Full list of Thai provinces for autocomplete */
export const THAI_PROVINCES = [
  "กรุงเทพมหานคร", "กระบี่", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร", "ขอนแก่น",
  "จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ชัยนาท", "ชัยภูมิ", "ชุมพร", "เชียงราย",
  "เชียงใหม่", "ตรัง", "ตราด", "ตาก", "นครนายก", "นครปฐม", "นครพนม", "นครราชสีมา",
  "นครศรีธรรมราช", "นครสวรรค์", "นนทบุรี", "นราธิวาส", "น่าน", "บึงกาฬ", "บุรีรัมย์",
  "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี", "ปัตตานี", "พระนครศรีอยุธยา", "พะเยา",
  "พังงา", "พัทลุง", "พิจิตร", "พิษณุโลก", "เพชรบุรี", "เพชรบูรณ์", "แพร่", "ภูเก็ต",
  "มหาสารคาม", "มุกดาหาร", "ยะลา", "ยโสธร", "ระนอง", "ระยอง", "ราชบุรี", "ร้อยเอ็ด",
  "ลพบุรี", "ลำปาง", "ลำพูน", "เลย", "ศรีสะเกษ", "สกลนคร", "สงขลา", "สตูล",
  "สมุทรปราการ", "สมุทรสงคราม", "สมุทรสาคร", "สระบุรี", "สระแก้ว", "สิงห์บุรี",
  "สุโขทัย", "สุพรรณบุรี", "สุราษฎร์ธานี", "สุรินทร์", "หนองคาย", "หนองบัวลำภู",
  "อ่างทอง", "อำนาจเจริญ", "อุดรธานี", "อุตรดิตถ์", "อุทัยธานี", "อุบลราชธานี",
];

/**
 * Province autocomplete input with filtered dropdown.
 *
 * Props:
 *  - value      {string}    Current province value
 *  - onChange   {function}  Called with new province string on change / selection
 *  - provinces  {string[]}  (optional) Override province list (defaults to THAI_PROVINCES)
 */
export default function ProvinceAutocomplete({
  value = "",
  onChange,
  provinces = THAI_PROVINCES,
}) {
  const [showList, setShowList] = useState(false);

  const trimmed = value.trim();

  const suggestions = provinces
    .filter((p) => p.includes(trimmed || ""))
    .slice(0, 6);

  return (
    <div className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowList(true);
        }}
        onFocus={() => setShowList(true)}
        onBlur={() => setTimeout(() => setShowList(false), 150)}
        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
        placeholder="เลือกจังหวัด"
      />
      {showList && trimmed && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white text-xs shadow-lg">
          {suggestions.map((p) => (
            <button
              key={p}
              type="button"
              className="block w-full px-3 py-1.5 text-left hover:bg-sky-50"
              onClick={() => {
                onChange(p);
                setShowList(false);
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
