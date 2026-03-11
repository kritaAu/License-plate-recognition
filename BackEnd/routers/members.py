"""
Member routes — CRUD operations for members and vehicles.
"""

import logging

from fastapi import APIRouter, HTTPException, Query

from core.database import supabase
from models.schemas import RegisterRequest, MemberUpdate

logger = logging.getLogger("app")

router = APIRouter(tags=["members"])


@router.get("/members")
def get_members(
    plate: str | None = Query(None),
    firstname: str | None = Query(None),
    lastname: str | None = Query(None),
):
    """Get all members with optional filters."""
    try:
        query_builder = supabase.table("Member").select(
            "member_id, firstname, lastname, std_id, faculty, major, role, "
            "Vehicle(plate, province)"
        )

        if firstname:
            query_builder = query_builder.ilike("firstname", f"%{firstname.strip()}%")
        if lastname:
            query_builder = query_builder.ilike("lastname", f"%{lastname.strip()}%")
        if plate:
            query_builder = query_builder.ilike("Vehicle.plate", f"%{plate.strip()}%")

        response = query_builder.execute()

        members = []
        for row in response.data or []:
            vehicle = row.get("Vehicle") or {}
            if isinstance(vehicle, list) and vehicle:
                vehicle = vehicle[0]
            elif isinstance(vehicle, list):
                vehicle = {}

            members.append(
                {
                    "member_id": row.get("member_id"),
                    "firstname": row.get("firstname"),
                    "lastname": row.get("lastname"),
                    "std_id": row.get("std_id"),
                    "faculty": row.get("faculty"),
                    "major": row.get("major"),
                    "role": row.get("role"),
                    "plate": vehicle.get("plate"),
                    "province": vehicle.get("province"),
                }
            )

        return members
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/members/register")
@router.post("/register")
def register_member_with_vehicle(payload: RegisterRequest):
    """Register new member with vehicle."""
    try:
        m_in = payload.member.model_dump(exclude_none=True)
        sid = m_in.get("std_id")
        if isinstance(sid, str) and sid.isdigit():
            m_in["std_id"] = int(sid)

        m_res = supabase.table("Member").insert(m_in).execute()
        if not m_res.data:
            raise HTTPException(status_code=400, detail="เพิ่มข้อมูลสมาชิกไม่สำเร็จ")

        member = m_res.data[0]
        member_id = member["member_id"]

        v_in = payload.vehicle.model_dump(exclude_none=True)
        v_in["member_id"] = member_id
        v_res = supabase.table("Vehicle").insert(v_in).execute()

        if not v_res.data:
            supabase.table("Member").delete().eq("member_id", member_id).execute()
            raise HTTPException(
                status_code=400, detail="เพิ่มข้อมูลรถไม่สำเร็จ (Member ถูก Rollback)"
            )

        vehicle = v_res.data[0]
        return {
            "message": "เพิ่มข้อมูลสมาชิกและรถเรียบร้อยแล้ว",
            "row": {
                "member_id": member_id,
                "std_id": member.get("std_id"),
                "firstname": member.get("firstname"),
                "lastname": member.get("lastname"),
                "plate": vehicle.get("plate"),
                "province": vehicle.get("province"),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/members/{member_id}")
def update_member(member_id: int, payload: MemberUpdate):
    """Update member information."""
    try:
        update_data = payload.model_dump(exclude_none=True)
        if not update_data:
            raise HTTPException(status_code=400, detail="ไม่มีข้อมูลที่ต้องการอัปเดต")

        response = (
            supabase.table("Member")
            .update(update_data)
            .eq("member_id", member_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=404, detail="ไม่พบสมาชิกในระบบ")

        return {"message": "อัปเดตข้อมูลเรียบร้อยแล้ว", "data": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/members/{member_id}")
def delete_member(member_id: int):
    """Delete member and associated vehicle."""
    try:
        old_resp = (
            supabase.table("Member").select("*").eq("member_id", member_id).execute()
        )
        if not old_resp.data:
            raise HTTPException(status_code=404, detail="ไม่พบสมาชิกในระบบ")

        supabase.table("Vehicle").delete().eq("member_id", member_id).execute()
        supabase.table("Member").delete().eq("member_id", member_id).execute()

        return {
            "message": "ลบสมาชิกและรถที่ผูกอยู่เรียบร้อยแล้ว",
            "deleted_data": old_resp.data[0],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/members/batch")
def get_members_batch(plates: list[str]):
    """Get members by multiple plates."""
    try:
        if not plates or len(plates) > 100:
            raise HTTPException(status_code=400, detail="Please provide 1-100 plates")

        response = (
            supabase.table("Member")
            .select(
                "member_id, firstname, lastname, std_id, faculty, major, role, "
                "Vehicle(plate, province)"
            )
            .execute()
        )

        all_members = response.data or []
        plate_map = {plate.strip().lower(): None for plate in plates}
        results = {}

        for row in all_members:
            vehicle = row.get("Vehicle")
            if isinstance(vehicle, list) and vehicle:
                vehicle = vehicle[0]
            elif isinstance(vehicle, list):
                continue

            vehicle_plate = vehicle.get("plate", "").strip().lower()

            if vehicle_plate in plate_map:
                results[vehicle.get("plate")] = {
                    "member_id": row.get("member_id"),
                    "firstname": row.get("firstname"),
                    "lastname": row.get("lastname"),
                    "std_id": row.get("std_id"),
                    "faculty": row.get("faculty"),
                    "major": row.get("major"),
                    "role": row.get("role"),
                    "plate": vehicle.get("plate"),
                    "province": vehicle.get("province"),
                }

        logger.info(
            f"Batch query: {len(plates)} plates requested, {len(results)} found"
        )
        return results

    except Exception as e:
        logger.error(f"Error in batch query: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
