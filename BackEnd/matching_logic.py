from rapidfuzz import fuzz
from datetime import datetime
from supabase import Client
import re


def extract_plate_parts(plate: str):
    """แยกส่วนของป้ายทะเบียน: ตัวเลข vs ตัวอักษร"""
    if not plate:
        return None, None

    # ลบช่องว่างทั้งหมด
    clean = "".join(plate.split())

    # หาตัวเลข 4 ตัวท้าย (มักจะเป็นเลขทะเบียนหลัก)
    numbers = re.findall(r"\d+", clean)
    last_number = numbers[-1] if numbers else ""

    # ส่วนที่เหลือคือตัวอักษร + เลขหน้า
    prefix = clean.replace(last_number, "") if last_number else clean

    return prefix, last_number


def find_best_match(plate_out: str, province: str, supabase: Client):
    """
    หาคู่ที่ตรงที่สุดจาก status='parked'

    ลำดับความแม่นยำ:
    1. Exact Match (100%) - ทุกอย่างตรงเป๊ะ
    2. Number Match (95%) - เลข 4 ตัว + จังหวัดตรง, ตัวอักษรคล้าย
    3. Fuzzy Match (80%+) - ใช้ fuzzy matching
    """

    # 1. ค้นหา sessions ที่ยังจอดอยู่
    parked = (
        supabase.table("ParkingSession")
        .select("*")
        .eq("status", "parked")
        .is_("exit_time", "null")
        .execute()
    )

    if not parked.data:
        return None

    # แยกส่วนของป้ายทะเบียนออก
    prefix_out, number_out = extract_plate_parts(plate_out)
    province_out = (province or "").strip().lower()

    best_match = None
    highest_score = 0
    match_type = None

    for session in parked.data:
        plate_entry = session.get("plate_number_entry", "")
        province_entry = (session.get("province", "") or "").strip().lower()

        # === EXACT MATCH (100%) ===
        if (
            plate_out.strip().lower() == plate_entry.strip().lower()
            and province_out == province_entry
        ):
            return {"session": session, "match_type": "exact", "confidence": 1.0}

        # === NUMBER MATCH (95%) ===
        # ถ้าเลข 4 ตัว + จังหวัดตรง → ถือว่าเป็นคันเดียวกัน
        if number_out and province_out and province_entry:
            prefix_entry, number_entry = extract_plate_parts(plate_entry)

            # เช็คว่าเลขตรงและจังหวัดตรง
            if number_out == number_entry and province_out == province_entry:
                # ให้ score สูงมาก แต่ลดหน่อยถ้าตัวอักษรต่างกันมาก
                prefix_similarity = (
                    fuzz.ratio(prefix_out or "", prefix_entry or "") / 100.0
                )
                confidence = 0.95 if prefix_similarity > 0.5 else 0.90

                if confidence > highest_score:
                    highest_score = confidence
                    best_match = session
                    match_type = "number_match"
                    continue

        # === FUZZY MATCH (80%+) ===
        # ใช้เมื่อไม่มี exact หรือ number match
        plate_score = fuzz.ratio(plate_out, plate_entry) / 100.0
        province_score = fuzz.ratio(province_out, province_entry) / 100.0

        # คำนวณ weighted score (ป้ายทะเบียนสำคัญกว่าจังหวัด)
        combined_score = (plate_score * 0.8) + (province_score * 0.2)

        if combined_score > 0.80 and combined_score > highest_score:
            highest_score = combined_score
            best_match = session
            match_type = "fuzzy"

    # ส่งค่ากลับ
    if best_match:
        return {
            "session": best_match,
            "match_type": match_type or "fuzzy",
            "confidence": round(highest_score, 2),
        }

    return None
