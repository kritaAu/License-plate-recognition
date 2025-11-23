from rapidfuzz import fuzz
from datetime import datetime
from supabase import Client
import re
import logging

# ตั้งค่า Logger
logger = logging.getLogger("matching_logic")
logger.setLevel(logging.INFO)


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


def find_best_match(plate_out: str, province: str, supabase: Client):
    """
    หาคู่ที่ตรงที่สุดจาก status='parked'
    เน้นความแม่นยำของตัวเลขมากกว่าตัวอักษร (แก้ปัญหากง/กว)
    """

    # 1. ค้นหา sessions ที่ยังจอดอยู่
    parked = (
        supabase.table("parkingsession")
        .select("*")
        .eq("status", "parked")
        .is_("exit_time", "null")
        .execute()
    )

    if not parked.data:
        # logger.info(f"❌ No parked sessions found for {plate_out}")
        return None

    # แยกส่วนของป้ายทะเบียนขาออก
    prefix_out, number_out = extract_plate_parts(plate_out)
    province_out = (province or "").strip().lower()

    logger.info(
        f"Matching: {plate_out} (Pre:{prefix_out}, Num:{number_out}) Prov:{province_out}"
    )

    best_match = None
    highest_score = 0
    match_type = None

    for session in parked.data:
        plate_entry = session.get("plate_number_entry", "")
        province_entry = (session.get("province", "") or "").strip().lower()

        # === 1. EXACT MATCH (100%) ===
        # ถ้าตรงกันเป๊ะ ให้คะแนนเต็มเลย
        if (
            plate_out.replace(" ", "") == plate_entry.replace(" ", "")
            and province_out == province_entry
        ):
            return {"session": session, "match_type": "exact", "confidence": 1.0}

        # === 2. NUMBER PRIORITY MATCH (Case กง vs กว) ===
        if number_out:
            prefix_entry, number_entry = extract_plate_parts(plate_entry)

            # เช็คว่าเลขทะเบียนตรงกันหรือไม่ (สำคัญที่สุด)
            if number_out == number_entry:

                # เช็คความเหมือนของจังหวัด (เผื่อ OCR อ่านจังหวัดเพี้ยนเล็กน้อย หรือมีการตัดคำว่า จังหวัด ออก)
                prov_score = fuzz.ratio(province_out, province_entry)

                # เช็คความเหมือนของหมวดอักษร (Prefix)
                prefix_score = fuzz.ratio(prefix_out, prefix_entry)

                # คำนวณ Score ใหม่
                # ถ้าเลขตรง + จังหวัดตรง (หรือใกล้เคียงมาก > 80%)
                if prov_score > 80:
                    current_conf = 0.0
                    m_type = "fuzzy"

                    if prefix_score > 70:
                        # หมวดอักษรใกล้กันมาก (เช่น กง/กว) -> มั่นใจสูง
                        current_conf = 0.95
                        m_type = "number_strong_fuzzy"
                    elif prefix_score > 40:
                        # หมวดอักษรเพี้ยนแต่ยังพอมีเค้าโครง -> มั่นใจปานกลาง
                        current_conf = 0.85
                        m_type = "number_weak_fuzzy"
                    else:
                        # หมวดอักษรต่างกันเลย (เช่น กง vs ญญ) -> แต่อาจจะเป็นคันเดิมถ้าจังหวัดตรงและเลขตรง
                        current_conf = 0.75
                        m_type = "number_only"

                    if current_conf > highest_score:
                        highest_score = current_conf
                        best_match = session
                        match_type = m_type
                        continue

        # === 3. PURE FUZZY MATCH (Fallback) ===
        # กรณีเลขอ่านผิดด้วย (เช่น 7405 อ่านเป็น 740S)
        plate_score = fuzz.ratio(plate_out, plate_entry) / 100.0
        province_score = fuzz.ratio(province_out, province_entry) / 100.0

        # ให้ความสำคัญกับป้ายทะเบียนมากกว่าจังหวัด
        combined_score = (plate_score * 0.85) + (province_score * 0.15)

        if combined_score > 0.80 and combined_score > highest_score:
            highest_score = combined_score
            best_match = session
            match_type = "fuzzy"

    # ตัดสินใจส่งค่ากลับ (Threshold = 0.75)
    if best_match and highest_score >= 0.75:
        logger.info(
            f"Match Found: {best_match['plate_number_entry']} (Score: {highest_score:.2f})"
        )
        return {
            "session": best_match,
            "match_type": match_type,
            "confidence": round(highest_score, 2),
        }

    return None
