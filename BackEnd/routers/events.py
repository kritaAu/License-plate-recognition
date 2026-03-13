"""
Event routes — create, read, update events.
"""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from core.database import supabase
from core.websocket import manager
from helpers import canon_plate, canon_text, clean_blob
from services.matching_logic import find_best_match
from models.schemas import EventIn, EventUpdate

logger = logging.getLogger("app")

router = APIRouter(tags=["events"])


@router.get("/events")
def get_events(
    limit: int = Query(1000, ge=1),
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
    direction: str | None = Query(None),
    query: str | None = Query(None, description="Plate query"),
):
    """Get all events with filters."""
    try:
        qb = (
            supabase.table("Event")
            .select(
                "event_id, datetime, plate, province, direction, blob, vehicle_id, "
                "Vehicle!Event_vehicle_id_fkey("
                "  plate, province, "
                "  Member!Vehicle_member_id_fkey(firstname, lastname, role, std_id)"
                ")"
            )
            .order("datetime", desc=True)
            .limit(limit)
        )

        if start_date:
            qb = qb.gte("datetime", f"{start_date}T00:00:00")
        if end_date:
            qb = qb.lte("datetime", f"{end_date}T23:59:59")
        if direction and direction.lower() != "all":
            qb = qb.eq("direction", direction.upper())
        if query:
            qb = qb.ilike("plate", f"%{query.strip()}%")

        resp = qb.execute()
        dir_th = {"IN": "เข้า", "OUT": "ออก"}
        results = []

        for e in resp.data or []:
            vehicle = e.get("Vehicle") or {}
            if isinstance(vehicle, list):
                vehicle = vehicle[0] if vehicle else {}

            member = vehicle.get("Member") or {}
            if isinstance(member, list):
                member = member[0] if member else {}

            role = member.get("role")
            check_status = (
                "บุคคล ภายนอก"
                if not role or str(role).lower() == "visitor"
                else "บุคคล ภายใน"
            )

            direction_en = (e.get("direction") or "").upper()
            direction_th = dir_th.get(direction_en, "ไม่ทราบ")

            member_name = None
            if member.get("firstname") or member.get("lastname"):
                member_name = f"{member.get('firstname', '')} {member.get('lastname', '')}".strip()

            results.append(
                {
                    "event_id": e.get("event_id"),
                    "time": e.get("datetime"),
                    "plate": e.get("plate") or "-",
                    "province": e.get("province") or "-",
                    "status": direction_th,
                    "check": check_status,
                    "imgUrl": e.get("blob") or None,
                    "member_name": member_name,
                    "member_role": role,
                    "member_firstname": member.get("firstname"),
                    "member_lastname": member.get("lastname"),
                    "member_std_id": member.get("std_id"),
                }
            )

        filters = []
        if start_date:
            filters.append(f"from={start_date}")
        if end_date:
            filters.append(f"to={end_date}")
        if direction and direction.lower() != "all":
            filters.append(f"dir={direction}")
        if query:
            filters.append(f"plate={query}")

        filter_str = f" [{', '.join(filters)}]" if filters else ""
        logger.info(f"Events: {len(results)} records{filter_str}")

        return results

    except Exception as ex:
        logger.error(f"Events error: {str(ex)}")
        raise HTTPException(status_code=500, detail=f"Error fetching events: {str(ex)}")


@router.post("/events")
async def create_event(event: EventIn):
    """Create new event and handle parking session."""
    try:
        plate_raw = (event.plate or "").strip()
        prov_raw = (event.province or "").strip()

        direction = event.direction or (
            "IN" if event.cam_id == 1 else "OUT" if event.cam_id == 2 else "UNKNOWN"
        )

        image_url = clean_blob(event.blob)

        # Find vehicle data
        vehicle_data = None
        p_can = canon_plate(plate_raw)
        prov_can = canon_text(prov_raw)

        if p_can and prov_can:
            guess = (
                supabase.table("Vehicle")
                .select(
                    "vehicle_id, plate, province, member_id, "
                    "member:Member!Vehicle_member_id_fkey(role)"
                )
                .ilike("plate", f"%{plate_raw}%")
                .ilike("province", f"%{prov_raw}%")
                .limit(1)
                .execute()
            )
            if guess.data:
                vehicle_data = guess.data[0]

        # Insert event
        payload = {
            "datetime": event.datetime.isoformat(),
            "plate": event.plate or None,
            "province": event.province or None,
            "direction": direction,
            "blob": image_url,
            "cam_id": event.cam_id,
            "vehicle_id": vehicle_data["vehicle_id"] if vehicle_data else None,
        }

        response = supabase.table("Event").insert(payload).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="เพิ่มข้อมูล Event ไม่สำเร็จ")

        saved_event = response.data[0]
        event_id = saved_event["event_id"]

        # Handle parking session
        if direction == "IN":
            session_data = {
                "plate_number_entry": event.plate,
                "province": event.province,
                "entry_time": event.datetime.isoformat(),
                "status": "parked",
                "entry_event_id": event_id,
                "vehicle_id": vehicle_data["vehicle_id"] if vehicle_data else None,
                "member_id": vehicle_data["member_id"] if vehicle_data else None,
            }
            supabase.table("parkingsession").insert(session_data).execute()
            logger.info(f"Created parking session for {event.plate}")

        elif direction == "OUT" and event.plate:
            match_result = find_best_match(event.plate, event.province or "", supabase)

            if match_result:
                session = match_result["session"]
                entry_time = datetime.fromisoformat(session["entry_time"])
                exit_time = event.datetime
                duration = int((exit_time - entry_time).total_seconds() / 60)

                supabase.table("parkingsession").update(
                    {
                        "plate_number_exit": event.plate,
                        "exit_time": event.datetime.isoformat(),
                        "exit_event_id": event_id,
                        "status": "completed",
                        "match_type": match_result["match_type"],
                        "confidence_score": match_result["confidence"],
                        "duration_minutes": duration,
                    }
                ).eq("session_id", session["session_id"]).execute()

                logger.info(
                    f"Matched exit: {event.plate} ({match_result['match_type']}, "
                    f"confidence: {match_result['confidence']})"
                )
            else:
                unmatched_data = {
                    "plate_number_exit": event.plate,
                    "province": event.province,
                    "exit_time": event.datetime.isoformat(),
                    "status": "unmatched",
                    "exit_event_id": event_id,
                }
                supabase.table("parkingsession").insert(unmatched_data).execute()
                logger.warning(f"No match for exit: {event.plate}")

        # Broadcast WebSocket
        ws_payload = {
            "datetime": saved_event.get("datetime"),
            "plate": saved_event.get("plate") or "-",
            "province": saved_event.get("province") or "-",
            "direction": saved_event.get("direction") or "-",
            "role": (
                (vehicle_data.get("member") or {}).get("role")
                if vehicle_data
                else "Visitor"
            ),
            "image": saved_event.get("blob"),
            "blob": saved_event.get("blob"),
        }

        await manager.broadcast(json.dumps(ws_payload))

        return {
            "message": "เพิ่มข้อมูล Event เรียบร้อยแล้ว",
            "data": saved_event,
            "vehicle_info": vehicle_data or "ไม่พบข้อมูลรถในระบบ (บันทึกเป็น visitor)",
        }
    except Exception as e:
        logger.error(f"Error in create_event: {str(e)}")
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาด: {str(e)}")


@router.patch("/events/{event_id}")
def update_event(event_id: int, body: EventUpdate):
    """Update event plate or province."""
    try:
        if body.plate is None and body.province is None:
            raise HTTPException(
                status_code=400,
                detail="ต้องระบุอย่างน้อย 1 ฟิลด์ที่ต้องการแก้ไข (plate หรือ province)",
            )

        update_data = {}
        if body.plate is not None:
            update_data["plate"] = body.plate.strip()
        if body.province is not None:
            update_data["province"] = body.province.strip()

        check_resp = (
            supabase.table("Event")
            .select("event_id, datetime, plate, province")
            .eq("event_id", event_id)
            .execute()
        )

        if not check_resp.data:
            raise HTTPException(status_code=404, detail=f"ไม่พบ Event ID: {event_id}")

        update_resp = (
            supabase.table("Event")
            .update(update_data)
            .eq("event_id", event_id)
            .execute()
        )

        if not update_resp.data:
            raise HTTPException(status_code=500, detail="ไม่สามารถแก้ไขข้อมูลได้")

        updated_event = update_resp.data[0]
        logger.info(f"Updated Event ID {event_id}: {update_data}")

        return {
            "success": True,
            "message": "แก้ไขข้อมูลสำเร็จ",
            "data": {
                "event_id": updated_event.get("event_id"),
                "datetime": updated_event.get("datetime"),
                "plate": updated_event.get("plate"),
                "province": updated_event.get("province"),
            },
        }

    except HTTPException:
        raise
    except Exception as ex:
        logger.error(f"Error updating event {event_id}: {str(ex)}")
        raise HTTPException(
            status_code=500, detail=f"เกิดข้อผิดพลาดในการแก้ไขข้อมูล: {str(ex)}"
        )
