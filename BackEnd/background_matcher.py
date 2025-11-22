import asyncio
from datetime import datetime
from typing import TYPE_CHECKING
import logging

if TYPE_CHECKING:
    from supabase import Client

logger = logging.getLogger("background_matcher")
logger.setLevel(logging.INFO)


async def process_unmatched_sessions(supabase: "Client"):
    """
    รันทุก 30 วินาที - หาและ match session ที่ยังไม่ได้ pair
    """
    from matching_logic import find_best_match

    logger.info("🔄 Background matcher started - checking every 30 seconds")

    while True:
        try:
            # 1. หา exit ที่ยังไม่ match (status='unmatched')
            unmatched = (
                supabase.table("parkingsession")  # ✅ เปลี่ยนเป็นตัวพิมพ์เล็ก
                .select("*")
                .eq("status", "unmatched")
                .is_("entry_time", "null")
                .execute()
            )

            if not unmatched.data or len(unmatched.data) == 0:
                logger.debug("No unmatched sessions found")
                await asyncio.sleep(30)
                continue

            logger.info(f"🔍 Found {len(unmatched.data)} unmatched exit sessions")

            # 2. ลอง match แต่ละตัว
            matched_count = 0
            for exit_session in unmatched.data:
                plate_exit = exit_session.get("plate_number_exit")
                province_exit = exit_session.get("province", "")

                if not plate_exit:
                    logger.warning(
                        f"Exit session {exit_session.get('session_id')} has no plate"
                    )
                    continue

                logger.debug(f"Trying to match exit: {plate_exit} ({province_exit})")

                # ใช้ matching logic
                match_result = find_best_match(plate_exit, province_exit, supabase)

                if match_result:
                    entry_session = match_result["session"]

                    # คำนวณระยะเวลา
                    entry_time = datetime.fromisoformat(entry_session["entry_time"])
                    exit_time = datetime.fromisoformat(exit_session["exit_time"])
                    duration = int((exit_time - entry_time).total_seconds() / 60)

                    # อัปเดต entry session ให้เป็น completed
                    update_result = (
                        supabase.table("parkingsession")
                        .update(
                            {
                                "plate_number_exit": plate_exit,
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

                    if update_result.data:
                        # ลบ exit session ที่เป็น unmatched
                        supabase.table("parkingsession").delete().eq(
                            "session_id", exit_session["session_id"]
                        ).execute()

                        matched_count += 1
                        logger.info(
                            f"✅ [Background] Matched: {plate_exit} "
                            f"(type: {match_result['match_type']}, "
                            f"confidence: {match_result['confidence']:.2f}, "
                            f"duration: {duration} min)"
                        )
                    else:
                        logger.error(
                            f"❌ Failed to update entry session {entry_session['session_id']}"
                        )
                else:
                    logger.debug(f"❌ No match found for {plate_exit}")

            if matched_count > 0:
                logger.info(f"✅ Successfully matched {matched_count} sessions")

        except Exception as e:
            logger.error(f"❌ Background matcher error: {str(e)}", exc_info=True)

        await asyncio.sleep(30)
