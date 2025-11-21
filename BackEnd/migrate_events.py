from main_api import supabase
from datetime import datetime


def migrate_events_to_sessions():
    """แปลงข้อมูล Event เก่าเป็น ParkingSession"""

    # ดึง Events ทั้งหมด เรียงตามเวลา
    events = supabase.table("Event").select("*").order("datetime", desc=False).execute()

    parked = {}  # เก็บรถที่เข้ามาแล้ว รอออก

    for event in events.data:
        plate = event.get("plate")
        direction = event.get("direction")

        if not plate:
            continue

        key = f"{plate}_{event.get('province', '')}"

        if direction == "IN":
            # บันทึกเป็นรถเข้า
            parked[key] = {
                "plate_number_entry": plate,
                "province": event.get("province"),
                "entry_time": event["datetime"],
                "entry_event_id": event["event_id"],
                "vehicle_id": event.get("vehicle_id"),
                "status": "parked",
            }

        elif direction == "OUT" and key in parked:
            # จับคู่กับรถเข้า
            session_data = parked.pop(key)
            entry_time = datetime.fromisoformat(session_data["entry_time"])
            exit_time = datetime.fromisoformat(event["datetime"])
            duration = int((exit_time - entry_time).total_seconds() / 60)

            session_data.update(
                {
                    "plate_number_exit": plate,
                    "exit_time": event["datetime"],
                    "exit_event_id": event["event_id"],
                    "duration_minutes": duration,
                    "status": "completed",
                    "match_type": "exact",
                }
            )

            supabase.table("ParkingSession").insert(session_data).execute()

    # รถที่ยังไม่ออก
    for session_data in parked.values():
        supabase.table("ParkingSession").insert(session_data).execute()

    print(f"Migration completed!")


if __name__ == "__main__":
    migrate_events_to_sessions()
