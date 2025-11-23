import asyncio
from datetime import datetime
from typing import TYPE_CHECKING
import logging

if TYPE_CHECKING:
    from supabase import Client

logger = logging.getLogger("background_matcher")
logger.setLevel(logging.INFO)

# Constants
CHECK_INTERVAL_SECONDS = 30


def _calculate_duration_minutes(entry_time_str: str, exit_time_str: str) -> int:
    """คำนวณระยะเวลาจอดรถเป็นนาที"""
    entry_time = datetime.fromisoformat(entry_time_str)
    exit_time = datetime.fromisoformat(exit_time_str)
    duration_seconds = (exit_time - entry_time).total_seconds()
    return int(duration_seconds / 60)


def _fetch_unmatched_sessions(supabase: "Client"):
    """ดึง exit sessions ที่ยังไม่ได้ match"""
    return (
        supabase.table("parkingsession")
        .select("*")
        .eq("status", "unmatched")
        .is_("entry_time", "null")
        .execute()
    )


def _update_entry_session(
    supabase: "Client",
    entry_session: dict,
    exit_session: dict,
    match_result: dict,
    duration: int,
):
    """อัปเดต entry session ให้เป็น completed"""
    return (
        supabase.table("parkingsession")
        .update(
            {
                "plate_number_exit": exit_session["plate_number_exit"],
                "exit_time": exit_session["exit_time"],
                "exit_event_id": exit_session.get("exit_event_id"),
                "status": "completed",
                "match_type": match_result["match_type"],
                "confidence_score": match_result["confidence"],
                "duration_minutes": duration,
            }
        )
        .eq("session_id", entry_session["session_id"])
        .execute()
    )


def _delete_unmatched_session(supabase: "Client", session_id: str):
    """ลบ exit session ที่เป็น unmatched"""
    return (
        supabase.table("parkingsession").delete().eq("session_id", session_id).execute()
    )


def _validate_exit_session(exit_session: dict) -> bool:
    """ตรวจสอบว่า exit session มีข้อมูลครบถ้วน"""
    plate_exit = exit_session.get("plate_number_exit")

    if not plate_exit:
        logger.warning(f"Exit session {exit_session.get('session_id')} has no plate")
        return False

    return True


def _process_match_result(
    supabase: "Client", exit_session: dict, match_result: dict
) -> bool:
    """ประมวลผลการ match และอัปเดต database"""
    entry_session = match_result["session"]
    plate_exit = exit_session["plate_number_exit"]

    # คำนวณระยะเวลา
    duration = _calculate_duration_minutes(
        entry_session["entry_time"], exit_session["exit_time"]
    )

    # อัปเดต entry session ให้เป็น completed
    update_result = _update_entry_session(
        supabase, entry_session, exit_session, match_result, duration
    )

    if not update_result.data:
        logger.error(f"Failed to update entry session {entry_session['session_id']}")
        return False

    # ลบ exit session ที่เป็น unmatched
    _delete_unmatched_session(supabase, exit_session["session_id"])

    # Log success
    logger.info(
        f"[Background] Matched: {plate_exit} | "
        f"Type: {match_result['match_type']} | "
        f"Confidence: {match_result['confidence']:.2f} | "
        f"Duration: {duration} min"
    )

    return True


async def _match_single_session(supabase: "Client", exit_session: dict) -> bool:
    """พยายาม match exit session เดียว"""
    from matching_logic import find_best_match

    # ตรวจสอบข้อมูล
    if not _validate_exit_session(exit_session):
        return False

    plate_exit = exit_session.get("plate_number_exit")
    province_exit = exit_session.get("province", "")

    logger.debug(f"Trying to match exit: {plate_exit} ({province_exit})")

    # ใช้ matching logic
    match_result = find_best_match(plate_exit, province_exit, supabase)

    if not match_result:
        logger.debug(f"No match found for {plate_exit}")
        return False

    # ประมวลผลการ match
    return _process_match_result(supabase, exit_session, match_result)


async def _process_batch(supabase: "Client", unmatched_sessions: list) -> int:
    """ประมวลผล batch ของ unmatched sessions"""
    matched_count = 0

    for exit_session in unmatched_sessions:
        try:
            if await _match_single_session(supabase, exit_session):
                matched_count += 1
        except Exception as e:
            logger.error(
                f"Error matching session {exit_session.get('session_id')}: {e}",
                exc_info=True,
            )

    return matched_count


async def process_unmatched_sessions(supabase: "Client"):
    """
    รันทุก 30 วินาที - หาและ match session ที่ยังไม่ได้ pair
    """
    logger.info(
        f"Background matcher started - checking every {CHECK_INTERVAL_SECONDS}s"
    )

    while True:
        try:
            # ดึง exit sessions ที่ยังไม่ match
            unmatched = _fetch_unmatched_sessions(supabase)

            if not unmatched.data or len(unmatched.data) == 0:
                logger.debug("No unmatched sessions found")
                await asyncio.sleep(CHECK_INTERVAL_SECONDS)
                continue

            logger.info(f"🔍 Found {len(unmatched.data)} unmatched exit session(s)")

            # ประมวลผล batch
            matched_count = await _process_batch(supabase, unmatched.data)

            if matched_count > 0:
                logger.info(
                    f"Successfully matched {matched_count}/{len(unmatched.data)} "
                    f"session(s)"
                )

        except Exception as e:
            logger.error(f"Background matcher error: {str(e)}", exc_info=True)

        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
