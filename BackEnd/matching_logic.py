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
        "ระยอง": "ระยอง",
        "ชลบุรี": "ชลบุรี",
        "เชียงใหม่": "เชียงใหม่",
    }

    for key, value in province_map.items():
        if key in province_lower:
            return value.lower()

    return province_lower


def extract_plate_parts(plate: str):
    """แยกส่วนของป้ายทะเบียน: ตัวเลข vs ตัวอักษร"""
    if not plate:
        return None, None

    # ลบช่องว่างทั้งหมด และอักขระพิเศษ
    clean = "".join(e for e in plate if e.isalnum())

    # หาตัวเลขกลุ่มสุดท้าย (เลขทะเบียนหลัก)
    numbers = re.findall(r"\d+", clean)
    last_number = numbers[-1] if numbers else ""

    # ส่วนที่เหลือคือตัวอักษร + เลขหน้า
    prefix = clean.replace(last_number, "") if last_number else clean

    return prefix, last_number


def check_recent_entries(
    plate_out: str, province: str, supabase: Client, hours_back: int = 24
):
    """
    เช็คว่ามี Event เข้า (IN) ที่คล้ายกันในช่วง X ชั่วโมงที่ผ่านมาหรือไม่
    ช่วยเพิ่มความมั่นใจในการ match
    """
    try:
        # คำนวณเวลาย้อนหลัง
        time_threshold = (datetime.now() - timedelta(hours=hours_back)).isoformat()

        # ดึง Event ที่เป็น IN ในช่วงเวลาที่กำหนด
        recent_entries = (
            supabase.table("Event")
            .select("event_id, datetime, plate, province, direction")
            .eq("direction", "IN")
            .gte("datetime", time_threshold)
            .execute()
        )

        if not recent_entries.data:
            return []

        # หาป้ายที่คล้ายกัน
        prefix_out, number_out = extract_plate_parts(plate_out)
        province_out = (province or "").strip().lower()

        matching_entries = []

        for event in recent_entries.data:
            plate_entry = event.get("plate", "")
            province_entry = (event.get("province", "") or "").strip().lower()

            # เช็คความคล้าย
            prefix_entry, number_entry = extract_plate_parts(plate_entry)

            # ถ้าเลขทะเบียนตรงกัน + จังหวัดใกล้เคียง
            if number_out == number_entry:
                prov_score = fuzz.ratio(province_out, province_entry)
                if prov_score >= 70:
                    matching_entries.append({"event": event, "similarity": prov_score})

        logger.info(
            f"Found {len(matching_entries)} similar entries in last {hours_back}h"
        )
        return matching_entries

    except Exception as e:
        logger.error(f"Error checking recent entries: {e}")
        return []


def _calculate_number_match_score(prefix_score: float, event_boost: float):
    """คำนวณคะแนนจากการ match เลขทะเบียน"""
    if prefix_score >= 75:
        return 0.95 + event_boost, "number_strong_fuzzy"
    elif prefix_score >= 50:
        return 0.88 + event_boost, "number_medium_fuzzy"
    elif prefix_score >= 30:
        return 0.82 + event_boost, "number_weak_fuzzy"
    else:
        return 0.75 + event_boost, "number_only"


def _check_event_boost(entry_event_id, recent_entries, session_id):
    """เช็คว่า session มี Event ID ที่ตรงกับ recent_entries หรือไม่"""
    if not entry_event_id or not recent_entries:
        return 0.0

    for entry in recent_entries:
        if entry["event"]["event_id"] == entry_event_id:
            logger.debug(f"  Event match bonus for session {session_id}")
            return 0.05

    return 0.0


def _check_exact_match(plate_out: str, province_out: str, session: dict):
    """เช็ค Exact Match"""
    plate_entry = session.get("plate_number_entry", "")
    province_entry = normalize_province(session.get("province", ""))

    plate_match = (
        plate_out.replace(" ", "").lower() == plate_entry.replace(" ", "").lower()
    )
    province_match = province_out == province_entry

    if plate_match and province_match:
        logger.info(f"Exact match found: {plate_entry}")
        return {"session": session, "match_type": "exact", "confidence": 1.0}

    return None


def _check_number_priority_match(
    plate_out: str,
    province_out: str,
    prefix_out: str,
    number_out: str,
    session: dict,
    event_boost: float,
):
    """เช็ค Number-Priority Match (เน้นเลขทะเบียน)"""
    if not number_out:
        return None, 0.0, None

    plate_entry = session.get("plate_number_entry", "")
    province_entry = normalize_province(session.get("province", ""))

    prefix_entry, number_entry = extract_plate_parts(plate_entry)

    # เช็คว่าเลขทะเบียนตรงกันหรือไม่
    if number_out != number_entry:
        return None, 0.0, None

    # เช็คความเหมือนของจังหวัด
    prov_score = fuzz.ratio(province_out, province_entry)

    # ถ้าเลขตรง + จังหวัดตรง (หรือใกล้เคียงมาก)
    if prov_score < 60:
        return None, 0.0, None

    # เช็คความเหมือนของหมวดอักษร
    prefix_score = fuzz.ratio(prefix_out.lower(), prefix_entry.lower())

    # คำนวณคะแนน
    current_conf, m_type = _calculate_number_match_score(prefix_score, event_boost)

    logger.debug(
        f"  → Candidate: {plate_entry} | "
        f"Prefix:{prefix_score:.1f}% Province:{prov_score:.1f}% | "
        f"Score:{current_conf:.2f} Type:{m_type}"
    )

    return session, current_conf, m_type


def _check_fuzzy_match(
    plate_out: str, province_out: str, session: dict, event_boost: float
):
    """เช็ค Pure Fuzzy Match (Fallback)"""
    plate_entry = session.get("plate_number_entry", "")
    province_entry = normalize_province(session.get("province", ""))

    plate_score = (
        fuzz.ratio(
            plate_out.replace(" ", "").lower(), plate_entry.replace(" ", "").lower()
        )
        / 100.0
    )

    province_score = fuzz.ratio(province_out, province_entry) / 100.0

    # ให้ความสำคัญกับป้ายทะเบียนมากกว่าจังหวัด
    combined_score = (plate_score * 0.85) + (province_score * 0.15) + event_boost

    if combined_score < 0.70:
        return None, 0.0, None

    logger.debug(
        f"  → Fuzzy candidate: {plate_entry} | "
        f"Plate:{plate_score:.2f} Province:{province_score:.2f} | "
        f"Combined:{combined_score:.2f}"
    )

    return session, combined_score, "fuzzy"


def find_best_match(plate_out: str, province: str, supabase: Client):
    """
    หาคู่ที่ตรงที่สุดจาก status='parked'
    ปรับปรุง: เช็ค Event table ก่อน แล้วค่อย match กับ parkingsession
    เน้นความแม่นยำของตัวเลขมากกว่าตัวอักษร
    รองรับกรณี OCR อ่านหมวดอักษรผิด (เช่น กม/กพ)
    """
    # เพิ่มการเช็ค Event table ก่อน
    recent_entries = check_recent_entries(plate_out, province, supabase, hours_back=24)

    # ค้นหา sessions ที่ยังจอดอยู่
    parked = (
        supabase.table("parkingsession")
        .select("*")
        .eq("status", "parked")
        .is_("exit_time", "null")
        .execute()
    )

    if not parked.data:
        logger.warning("No parked sessions available")
        return None

    logger.info(f"Found {len(parked.data)} parked sessions to match against")

    # แยกส่วนของป้ายทะเบียนขาออก
    prefix_out, number_out = extract_plate_parts(plate_out)
    province_out = normalize_province(province)

    logger.info(
        f"🔍 Matching: {plate_out} (Pre:{prefix_out}, Num:{number_out}) "
        f"Prov:{province_out}"
    )

    best_match = None
    highest_score = 0
    match_type = None

    logger.debug(f"Checking {len(parked.data)} parked sessions...")

    for session in parked.data:
        logger.debug(
            f"  Comparing with: {session.get('plate_number_entry', '')} "
            f"({normalize_province(session.get('province', ''))})"
        )

        # 1. EXACT MATCH (100%)
        exact_result = _check_exact_match(plate_out, province_out, session)
        if exact_result:
            return exact_result

        # 2. เช็คว่า session นี้มี Event ID ที่ตรงกับ recent_entries หรือไม่
        event_boost = _check_event_boost(
            session.get("entry_event_id"), recent_entries, session.get("session_id")
        )

        # 3. NUMBER-PRIORITY MATCH (เน้นเลขทะเบียน)
        num_session, num_score, num_type = _check_number_priority_match(
            plate_out, province_out, prefix_out, number_out, session, event_boost
        )

        if num_session and num_score > highest_score:
            highest_score = num_score
            best_match = num_session
            match_type = num_type
            continue

        # 4. PURE FUZZY MATCH (Fallback)
        fuzzy_session, fuzzy_score, fuzzy_type = _check_fuzzy_match(
            plate_out, province_out, session, event_boost
        )

        if fuzzy_session and fuzzy_score > highest_score:
            highest_score = fuzzy_score
            best_match = fuzzy_session
            match_type = fuzzy_type

    # ตัดสินใจส่งค่ากลับ (Threshold = 0.70)
    if best_match and highest_score >= 0.70:
        logger.info(
            f"Match found: {best_match['plate_number_entry']} | "
            f"Type: {match_type} | Score: {highest_score:.2f}"
        )
        return {
            "session": best_match,
            "match_type": match_type,
            "confidence": round(highest_score, 2),
        }

    logger.warning(
        f"No match found for {plate_out} (highest score: {highest_score:.2f})"
    )
    return None
