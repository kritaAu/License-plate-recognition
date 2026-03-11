from rapidfuzz import fuzz
from datetime import datetime, timedelta
from supabase import Client
import re
import logging

# ตั้งค่า Logger
logger = logging.getLogger("matching_logic")
logger.setLevel(logging.INFO)


def normalize_province(province: str) -> str:
    """
    ปรับ normalize ชื่อจังหวัดให้เป็นมาตรฐาน
    เช่น "กรุงเทพฯ", "กทม", "กรุงเทพมหานคร" → "กรุงเทพมหานคร"
    """
    if not province:
        return ""

    province_lower = province.strip().lower()

    # Map ชื่อจังหวัดที่ใกล้เคียงกัน
    province_map = {
        "กทม": "กรุงเทพมหานคร",
        "กรุงเทพฯ": "กรุงเทพมหานคร",
        "กรุงเทพ": "กรุงเทพมหานคร",
        "โคราช": "นครราชสีมา",
        "เมืองหลวง": "กรุงเทพมหานคร",
    }

    for key, value in province_map.items():
        if key in province_lower:
            return value.lower()

    return province_lower


def extract_numbers_only(plate: str) -> str:
    """
    ดึงเฉพาะตัวเลขออกจากทะเบียน
    เช่น "8ฟม 4325" -> "4325"
    เช่น "1กก 1234" -> "1234" (เอาเฉพาะชุดหลัง)
    """
    if not plate:
        return ""

    # ดึงเลขทุกตัว
    numbers = re.findall(r"\d+", plate)

    # ถ้ามีเลขหลายชุด ให้เอาชุดสุดท้าย (ปกติทะเบียนคือ 1กก 1234 -> เอา 1234)
    if numbers:
        return numbers[-1]
    return ""


def extract_plate_parts(plate: str):
    """แยกส่วนของป้ายทะเบียน: ตัวเลข vs ตัวอักษร"""
    if not plate:
        return None, None

    clean = "".join(e for e in plate if e.isalnum())
    numbers = re.findall(r"\d+", clean)
    last_number = numbers[-1] if numbers else ""
    prefix = clean.replace(last_number, "") if last_number else clean

    return prefix, last_number


def check_recent_entries(
    plate_out: str, province: str, supabase: Client, hours_back: int = 24
):
    """เช็ค Event ย้อนหลังเพื่อช่วย Match"""
    try:
        time_threshold = (datetime.now() - timedelta(hours=hours_back)).isoformat()

        # ดึง Event ขาเข้าล่าสุด
        recent_entries = (
            supabase.table("Event")
            .select("event_id, datetime, plate, province, direction")
            .eq("direction", "IN")
            .gte("datetime", time_threshold)
            .execute()
        )

        if not recent_entries.data:
            return []

        # หาเฉพาะเลขทะเบียน
        number_out = extract_numbers_only(plate_out)
        province_out = normalize_province(province)

        matching_entries = []

        for event in recent_entries.data:
            plate_entry = event.get("plate", "")
            province_entry = normalize_province(event.get("province", ""))
            number_entry = extract_numbers_only(plate_entry)

            # Logic: เลขตรง + จังหวัดตรง = เก็บไว้พิจารณา
            if number_out == number_entry:
                prov_score = fuzz.ratio(province_out, province_entry)
                if prov_score >= 80:  # จังหวัดต้องค่อนข้างชัวร์
                    matching_entries.append({"event": event, "similarity": prov_score})

        return matching_entries

    except Exception as e:
        logger.error(f"Error checking recent entries: {e}")
        return []


def _check_exact_match(plate_out: str, province_out: str, session: dict):
    """1. เช็คเป๊ะทุกตัวอักษร"""
    plate_entry = session.get("plate_number_entry", "")
    province_entry = normalize_province(session.get("province", ""))

    plate_match = (
        plate_out.replace(" ", "").lower() == plate_entry.replace(" ", "").lower()
    )
    province_match = province_out == province_entry

    if plate_match and province_match:
        return {"session": session, "match_type": "exact", "confidence": 1.0}

    return None


def _check_numeric_ignore_thai(
    plate_out: str, province_out: str, session: dict, event_boost: float
):
    """
    2. เช็คแบบไม่สนอักษรไทย (Numeric Match)
    Logic: เลขตรงเป๊ะ + จังหวัดตรงเป๊ะ = Match เลย (Confidence สูง)
    """
    plate_entry = session.get("plate_number_entry", "")
    province_entry = normalize_province(session.get("province", ""))

    # ดึงเฉพาะตัวเลข
    num_out = extract_numbers_only(plate_out)
    num_entry = extract_numbers_only(plate_entry)

    # 1. เลขต้องมีค่าและต้องตรงกันเป๊ะๆ
    if not num_out or not num_entry or num_out != num_entry:
        return None, 0.0, None

    # 2. จังหวัดต้องตรงกัน (หรือใกล้เคียงมากๆ)
    prov_score = fuzz.ratio(province_out, province_entry)

    if prov_score >= 85:  # ยอมให้ผิดนิดเดียว เช่น กทม. vs กรุงเทพ
        # คำนวณความเหมือนของ Prefix (อักษรหน้า) ไว้ประดับบารมี แต่ไม่ได้ใช้ตัดเกรดโหด
        # เพื่อแยกกรณีรถคนละคันแต่เลขเหมือนกัน (1กก 1234 vs 2ขข 1234)
        # แต่ User บอกว่าไม่ต้องสนอักษรไทย ดังนั้นเราให้ Score สูงเลยถ้าเลขตรง

        base_score = 0.90  # ให้คะแนนเริ่มต้นสูงมากเพราะเลขตรง+จังหวัดตรง
        final_score = base_score + event_boost

        logger.info(f"Numeric Match Found! {plate_entry} == {plate_out} (Ignore Thai)")
        return session, final_score, "numeric_ignore_thai"

    return None, 0.0, None


def _check_fuzzy_match(
    plate_out: str, province_out: str, session: dict, event_boost: float
):
    """3. เช็คแบบคล้ายคลึง (Fuzzy - กรณีเลขอาจจะเพี้ยนด้วย)"""
    plate_entry = session.get("plate_number_entry", "")
    province_entry = normalize_province(session.get("province", ""))

    plate_score = (
        fuzz.ratio(plate_out.replace(" ", ""), plate_entry.replace(" ", "")) / 100.0
    )
    province_score = fuzz.ratio(province_out, province_entry) / 100.0

    combined_score = (plate_score * 0.7) + (province_score * 0.3) + event_boost

    if combined_score > 0.75:
        return session, combined_score, "fuzzy"

    return None, 0.0, None


def find_best_match(plate_out: str, province: str, supabase: Client):
    """
    หาคู่ที่ตรงที่สุด โดยเรียงลำดับความสำคัญ:
    1. ตรงเป๊ะ (Exact)
    2. เลขตรง+จังหวัดตรง (Numeric Ignore Thai) **ตามที่ user ขอ**
    3. คล้ายคลึง (Fuzzy)
    """
    # 1. เตรียมข้อมูล
    recent_entries = check_recent_entries(plate_out, province, supabase)

    parked = (
        supabase.table("parkingsession")
        .select("*")
        .eq("status", "parked")
        .is_("exit_time", "null")
        .execute()
    )

    if not parked.data:
        return None

    province_out = normalize_province(province)

    best_match = None
    highest_score = 0
    match_type = None

    # วนลูปเช็คทุกคันที่จอดอยู่
    for session in parked.data:
        # Boost คะแนนถ้า Event ID ตรงกับประวัติที่ดึงมา
        event_boost = (
            0.05
            if any(
                r["event"]["event_id"] == session.get("entry_event_id")
                for r in recent_entries
            )
            else 0.0
        )

        # Step 1: Exact Match
        res = _check_exact_match(plate_out, province_out, session)
        if res:
            return res  # เจอเป๊ะ คืนค่าเลย

        # Step 2: Numeric Match (Ignore Thai Chars) <-- ไฮไลท์ของคำถามนี้
        num_sess, num_score, num_type = _check_numeric_ignore_thai(
            plate_out, province_out, session, event_boost
        )
        if num_sess and num_score > highest_score:
            highest_score = num_score
            best_match = num_sess
            match_type = num_type
            continue  # ถ้าเจอแบบนี้แล้ว ไม่ต้องไปเช็ค Fuzzy ธรรมดา

        # Step 3: Fuzzy Match (เก็บตก)
        fuz_sess, fuz_score, fuz_type = _check_fuzzy_match(
            plate_out, province_out, session, event_boost
        )
        if fuz_sess and fuz_score > highest_score:
            highest_score = fuz_score
            best_match = fuz_sess
            match_type = fuz_type

    # สรุปผล
    if best_match and highest_score >= 0.70:
        return {
            "session": best_match,
            "match_type": match_type,
            "confidence": round(highest_score, 2),
        }

    return None
