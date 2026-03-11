from core.database import supabase
from datetime import datetime
import logging

logger = logging.getLogger("migrate_events")
logger.setLevel(logging.INFO)


def _calculate_duration_minutes(entry_time_str: str, exit_time_str: str) -> int:
    """คำนวณระยะเวลาจอดรถเป็นนาที"""
    entry_time = datetime.fromisoformat(entry_time_str)
    exit_time = datetime.fromisoformat(exit_time_str)
    duration_seconds = (exit_time - entry_time).total_seconds()
    return int(duration_seconds / 60)


def _create_session_key(plate: str, province: str) -> str:
    """สร้าง unique key สำหรับ session"""
    return f"{plate}_{province or ''}"


def _create_entry_session(event: dict) -> dict:
    """สร้าง entry session data จาก Event"""
    return {
        "plate_number_entry": event.get("plate"),
        "province": event.get("province"),
        "entry_time": event["datetime"],
        "entry_event_id": event["event_id"],
        "vehicle_id": event.get("vehicle_id"),
        "status": "parked",
    }


def _create_completed_session(entry_data: dict, exit_event: dict) -> dict:
    """สร้าง completed session data"""
    duration = _calculate_duration_minutes(
        entry_data["entry_time"], exit_event["datetime"]
    )

    return {
        **entry_data,
        "plate_number_exit": exit_event.get("plate"),
        "exit_time": exit_event["datetime"],
        "exit_event_id": exit_event["event_id"],
        "duration_minutes": duration,
        "status": "completed",
        "match_type": "exact",
    }


def _fetch_all_events():
    """ดึง Events ทั้งหมดเรียงตามเวลา"""
    return supabase.table("Event").select("*").order("datetime", desc=False).execute()


def _insert_session(session_data: dict) -> bool:
    """บันทึก session ลง database"""
    try:
        supabase.table("ParkingSession").insert(session_data).execute()
        return True
    except Exception as e:
        logger.error(f"❌ Failed to insert session: {e}")
        return False


def _process_entry_event(event: dict, parked: dict) -> None:
    """ประมวลผล Event เข้า (IN)"""
    plate = event.get("plate")
    key = _create_session_key(plate, event.get("province", ""))

    parked[key] = _create_entry_session(event)
    logger.debug(f"📥 Entry recorded: {plate}")


def _process_exit_event(event: dict, parked: dict) -> int:
    """ประมวลผล Event ออก (OUT)"""
    plate = event.get("plate")
    key = _create_session_key(plate, event.get("province", ""))

    if key not in parked:
        logger.debug(f"⚠️ Exit without entry: {plate}")
        return 0

    # จับคู่กับรถเข้า
    entry_data = parked.pop(key)
    session_data = _create_completed_session(entry_data, event)

    if _insert_session(session_data):
        logger.debug(
            f"✅ Completed session: {plate} | "
            f"Duration: {session_data['duration_minutes']} min"
        )
        return 1

    return 0


def _process_remaining_parked_sessions(parked: dict) -> int:
    """ประมวลผลรถที่ยังไม่ออก"""
    inserted_count = 0

    for session_data in parked.values():
        if _insert_session(session_data):
            plate = session_data.get("plate_number_entry")
            logger.debug(f"📌 Parked session: {plate}")
            inserted_count += 1

    return inserted_count


def migrate_events_to_sessions():
    """
    แปลงข้อมูล Event เก่าเป็น ParkingSession
    - จับคู่ IN/OUT events
    - สร้าง completed sessions สำหรับรถที่ออกแล้ว
    - สร้าง parked sessions สำหรับรถที่ยังไม่ออก
    """
    logger.info("🚀 Starting migration: Events → ParkingSessions")

    # ดึง Events ทั้งหมด
    events = _fetch_all_events()

    if not events.data:
        logger.warning("⚠️ No events found to migrate")
        return

    logger.info(f"📊 Found {len(events.data)} events to process")

    parked = {}  # เก็บรถที่เข้ามาแล้ว รอออก
    completed_count = 0

    # ประมวลผลแต่ละ event
    for event in events.data:
        plate = event.get("plate")
        direction = event.get("direction")

        if not plate:
            logger.debug(f"⚠️ Event {event.get('event_id')} has no plate")
            continue

        if direction == "IN":
            _process_entry_event(event, parked)

        elif direction == "OUT":
            completed_count += _process_exit_event(event, parked)

    # ประมวลผลรถที่ยังไม่ออก
    parked_count = _process_remaining_parked_sessions(parked)

    # สรุปผล
    total_sessions = completed_count + parked_count
    logger.info("=" * 50)
    logger.info("✅ Migration completed!")
    logger.info(f"📊 Total events processed: {len(events.data)}")
    logger.info(f"✅ Completed sessions: {completed_count}")
    logger.info(f"📌 Parked sessions: {parked_count}")
    logger.info(f"📈 Total sessions created: {total_sessions}")
    logger.info("=" * 50)


if __name__ == "__main__":
    # ตั้งค่า logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    migrate_events_to_sessions()
