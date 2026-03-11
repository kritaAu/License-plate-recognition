"""
Parking session routes — entry, exit, session listing, fix-plate.
"""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from core.database import supabase
from core.websocket import manager
from helpers import clean_blob
from matching_logic import find_best_match
from models.schemas import EventIn

logger = logging.getLogger("app")

router = APIRouter(prefix="/api", tags=["parking"])


@router.post("/entry")
async def record_entry(event: EventIn):
    """Record vehicle entry."""
    try:
        image_url = clean_blob(event.blob)

        event_data = {
            "datetime": event.datetime.isoformat(),
            "plate": event.plate,
            "province": event.province,
            "direction": "IN",
            "blob": image_url,
            "cam_id": event.cam_id or 1,
        }
        event_resp = supabase.table("Event").insert(event_data).execute()

        if not event_resp.data:
            raise HTTPException(status_code=400, detail="บันทึก Event ไม่สำเร็จ")

        event_id = event_resp.data[0]["event_id"]

        vehicle_id = None
        member_id = None

        if event.plate and event.province:
            vehicle_search = (
                supabase.table("Vehicle")
                .select("vehicle_id, member_id")
                .ilike("plate", f"%{event.plate.strip()}%")
                .ilike("province", f"%{event.province.strip()}%")
                .limit(1)
                .execute()
            )

            if vehicle_search.data:
                vehicle_id = vehicle_search.data[0].get("vehicle_id")
                member_id = vehicle_search.data[0].get("member_id")

        session_data = {
            "plate_number_entry": event.plate,
            "province": event.province,
            "entry_time": event.datetime.isoformat(),
            "status": "parked",
            "entry_event_id": event_id,
            "vehicle_id": vehicle_id,
            "member_id": member_id,
        }
        session_resp = supabase.table("parkingsession").insert(session_data).execute()

        if not session_resp.data:
            raise HTTPException(status_code=400, detail="สร้าง Session ไม่สำเร็จ")

        await manager.broadcast(
            json.dumps(
                {
                    "type": "entry",
                    "plate": event.plate or "-",
                    "province": event.province or "-",
                    "time": event.datetime.isoformat(),
                    "status": "parked",
                    "image": image_url,
                }
            )
        )

        logger.info(f"Entry recorded: {event.plate} at {event.datetime}")

        return {
            "message": "บันทึกรถเข้าสำเร็จ",
            "session": session_resp.data[0],
            "event_id": event_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in record_entry: {str(e)}")
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาด: {str(e)}")


@router.post("/exit")
async def record_exit(event: EventIn):
    """Record vehicle exit."""
    try:
        image_url = clean_blob(event.blob)

        event_data = {
            "datetime": event.datetime.isoformat(),
            "plate": event.plate,
            "province": event.province,
            "direction": "OUT",
            "blob": image_url,
            "cam_id": event.cam_id or 2,
        }
        event_resp = supabase.table("Event").insert(event_data).execute()

        if not event_resp.data:
            raise HTTPException(status_code=400, detail="บันทึก Event ไม่สำเร็จ")

        exit_event_id = event_resp.data[0]["event_id"]

        # Find matching entry
        match_result = None
        if event.plate:
            match_result = find_best_match(event.plate, event.province or "", supabase)
            logger.info(f"Match result: {match_result}")

        # No match found
        if not match_result:
            logger.warning(f"No match found for exit: {event.plate}")

            session_data = {
                "plate_number_exit": event.plate,
                "province": event.province,
                "exit_time": event.datetime.isoformat(),
                "status": "unmatched",
                "exit_event_id": exit_event_id,
            }
            session_resp = (
                supabase.table("parkingsession").insert(session_data).execute()
            )

            await manager.broadcast(
                json.dumps(
                    {
                        "type": "exit",
                        "plate": event.plate or "-",
                        "status": "unmatched",
                        "time": event.datetime.isoformat(),
                    }
                )
            )

            return {
                "message": "ไม่พบข้อมูลรถเข้า (บันทึกเป็น unmatched)",
                "session": session_resp.data[0],
                "match_type": None,
            }

        # Match found — update session
        session = match_result["session"]
        entry_time = datetime.fromisoformat(session["entry_time"])
        exit_time = event.datetime
        duration = int((exit_time - entry_time).total_seconds() / 60)

        update_data = {
            "plate_number_exit": event.plate,
            "exit_time": event.datetime.isoformat(),
            "exit_event_id": exit_event_id,
            "status": "completed",
            "match_type": match_result["match_type"],
            "confidence_score": match_result["confidence"],
            "duration_minutes": duration,
        }

        updated = (
            supabase.table("parkingsession")
            .update(update_data)
            .eq("session_id", session["session_id"])
            .execute()
        )

        await manager.broadcast(
            json.dumps(
                {
                    "type": "exit",
                    "plate": event.plate or "-",
                    "match_type": match_result["match_type"],
                    "confidence": match_result["confidence"],
                    "duration": duration,
                    "status": "completed",
                    "time": event.datetime.isoformat(),
                }
            )
        )

        logger.info(
            f"Exit matched ({match_result['match_type']}): {event.plate}, "
            f"duration: {duration} min"
        )

        return {
            "message": "จับคู่สำเร็จ",
            "match_type": match_result["match_type"],
            "confidence": match_result["confidence"],
            "duration_minutes": duration,
            "session": updated.data[0] if updated.data else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in record_exit: {str(e)}")
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาด: {str(e)}")


@router.get("/parking-sessions")
def get_parking_sessions(
    status: str = Query("all", description="all, parked, completed, unmatched"),
    limit: int = Query(100, ge=1, le=1000),
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
):
    """Get parking sessions with filters."""
    try:
        qb = (
            supabase.table("parkingsession")
            .select(
                """
                session_id,
                plate_number_entry,
                plate_number_exit,
                province,
                entry_time,
                exit_time,
                status,
                match_type,
                confidence_score,
                duration_minutes,
                Member(firstname, lastname, role)
            """
            )
            .order("entry_time", desc=True)
            .limit(limit)
        )

        if status and status.lower() != "all":
            qb = qb.eq("status", status.lower())

        if start_date:
            qb = qb.gte("entry_time", f"{start_date}T00:00:00")
        if end_date:
            qb = qb.lte("entry_time", f"{end_date}T23:59:59")

        resp = qb.execute()

        results = []
        for s in resp.data or []:
            member = s.get("Member")
            if isinstance(member, list):
                member = member[0] if member else {}
            elif not member:
                member = {}

            member_name = (
                f"{member.get('firstname', '')} {member.get('lastname', '')}".strip()
            )

            results.append(
                {
                    "session_id": s["session_id"],
                    "plate_entry": s.get("plate_number_entry") or "-",
                    "plate_exit": s.get("plate_number_exit") or "-",
                    "province": s.get("province") or "-",
                    "entry_time": s.get("entry_time"),
                    "exit_time": s.get("exit_time"),
                    "duration_minutes": s.get("duration_minutes"),
                    "status": s["status"],
                    "match_type": s.get("match_type"),
                    "confidence": s.get("confidence_score"),
                    "member_name": member_name if member_name else None,
                    "member_role": member.get("role"),
                }
            )

        logger.info(f"Returned {len(results)} parking sessions")
        return results

    except Exception as e:
        logger.error(f"Error fetching parking sessions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/parking-sessions/{session_id}")
def get_session_detail(session_id: str):
    """Get detailed parking session information."""
    try:
        resp = (
            supabase.table("parkingsession")
            .select(
                """
                *,
                Member(firstname, lastname, role, std_id),
                entry_event:Event!parkingsession_entry_event_id_fkey(datetime, blob, plate, province),
                exit_event:Event!parkingsession_exit_event_id_fkey(datetime, blob, plate, province)
            """
            )
            .eq("session_id", session_id)
            .execute()
        )

        if not resp.data:
            raise HTTPException(status_code=404, detail="ไม่พบ Session นี้")

        session = resp.data[0]

        member = session.get("Member") or {}
        entry_event = session.get("entry_event") or {}
        exit_event = session.get("exit_event") or {}

        if isinstance(member, list):
            member = member[0] if member else {}
        if isinstance(entry_event, list):
            entry_event = entry_event[0] if entry_event else {}
        if isinstance(exit_event, list):
            exit_event = exit_event[0] if exit_event else {}

        return {
            "session_id": session["session_id"],
            "status": session["status"],
            "match_type": session.get("match_type"),
            "confidence": session.get("confidence_score"),
            "duration_minutes": session.get("duration_minutes"),
            "entry": {
                "plate": session.get("plate_number_entry"),
                "province": session.get("province"),
                "time": session.get("entry_time"),
                "image": entry_event.get("blob"),
            },
            "exit": (
                {
                    "plate": session.get("plate_number_exit"),
                    "time": session.get("exit_time"),
                    "image": exit_event.get("blob"),
                }
                if session.get("exit_time")
                else None
            ),
            "member": (
                {
                    "name": f"{member.get('firstname', '')} {member.get('lastname', '')}".strip(),
                    "role": member.get("role"),
                    "std_id": member.get("std_id"),
                }
                if member
                else None
            ),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session detail: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.patch("/parking-sessions/{session_id}/fix-plate")
def fix_session_plate(
    session_id: str,
    correct_plate: str = Query(..., description="ป้ายทะเบียนที่ถูกต้อง"),
    correct_province: str = Query(..., description="จังหวัดที่ถูกต้อง"),
):
    """Fix incorrect plate number in parking session."""
    try:
        check = (
            supabase.table("parkingsession")
            .select("session_id, status")
            .eq("session_id", session_id)
            .execute()
        )

        if not check.data:
            raise HTTPException(status_code=404, detail="ไม่พบ Session นี้")

        update_data = {
            "plate_number_entry": correct_plate.strip(),
            "province": correct_province.strip(),
        }

        if check.data[0]["status"] in ["completed", "unmatched"]:
            update_data["plate_number_exit"] = correct_plate.strip()

        updated = (
            supabase.table("parkingsession")
            .update(update_data)
            .eq("session_id", session_id)
            .execute()
        )

        if not updated.data:
            raise HTTPException(status_code=500, detail="อัปเดตไม่สำเร็จ")

        logger.info(f"Fixed plate for session {session_id}: {correct_plate}")

        return {"message": "แก้ไขป้ายทะเบียนสำเร็จ", "data": updated.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fixing plate: {str(e)}")
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาด: {str(e)}")
