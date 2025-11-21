from rapidfuzz import fuzz
from datetime import datetime
from supabase import Client


def find_best_match(plate_out: str, province: str, supabase: Client):
    """หาคู่ที่ตรงที่สุดจาก status='parked'"""

    # 1. ค้นหา sessions ที่ยังจอดอยู่
    parked = (
        supabase.table("ParkingSession")
        .select("*")
        .eq("status", "parked")
        .is_("exit_time", "null")
        .execute()
    )

    best_match = None
    highest_score = 0

    for session in parked.data or []:
        plate_entry = session.get("plate_number_entry", "")

        # 2. ลอง Exact Match ก่อน
        if plate_out.strip().lower() == plate_entry.strip().lower():
            return {"session": session, "match_type": "exact", "confidence": 1.0}

        # 3. Fuzzy Match (ถ้าไม่เจอ exact)
        score = fuzz.ratio(plate_out, plate_entry) / 100.0

        if score > 0.8 and score > highest_score:
            highest_score = score
            best_match = session

    if best_match:
        return {
            "session": best_match,
            "match_type": "fuzzy",
            "confidence": highest_score,
        }

    return None
