from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime
import cv2
import os
import uuid
from utils import upload_image_to_storage


# ====
#  ENVIRONMENT
# ====
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# ====
#  FASTAPI INITIALIZATION
# ====
app = FastAPI(title="License Plate Recognition API")

origins = ["http://localhost:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ====
#  MODELS
# ====
class EventIn(BaseModel):
    datetime: datetime
    plate: str | None = None
    province: str | None = None
    cam_id: int | None = None
    blob: str | None = None
    vehicle_id: int | None = None


class MemberCreate(BaseModel):
    firstname: str
    lastname: str
    std_id: int
    faculty: str
    major: str
    role: str


class VehicleCreate(BaseModel):
    plate: str
    province: str


class RegisterRequest(BaseModel):
    member: MemberCreate
    vehicle: VehicleCreate


class MemberUpdate(BaseModel):
    firstname: str | None = None
    lastname: str | None = None
    std_id: int | None = None
    faculty: str | None = None
    major: str | None = None
    role: str | None = None


# ====
#  ROUTES: MEMBERS
# ====


# ดึงข้อมูลสมาชิกทั้งหมด (พร้อมทะเบียนรถ)
@app.get("/members")
def get_members():
    try:
        response = (
            supabase.table("Member")
            .select(
                "member_id, firstname, lastname, std_id, faculty, major, role, Vehicle(plate, province)"
            )
            .execute()
        )

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


# เพิ่มข้อมูลสมาชิกใหม่
@app.post("/register")
def register_member_with_vehicle(payload: RegisterRequest):
    try:
        # เพิ่มข้อมูล Member
        member_data = payload.member.model_dump()
        member_resp = supabase.table("Member").insert(member_data).execute()

        if not member_resp.data:
            raise HTTPException(status_code=400, detail="เพิ่มข้อมูลสมาชิกไม่สำเร็จ")

        member_id = member_resp.data[0]["member_id"]

        # เพิ่มข้อมูล Vehicle (เชื่อม foreign key member_id)
        vehicle_data = payload.vehicle.model_dump()
        vehicle_data["member_id"] = member_id

        vehicle_resp = supabase.table("Vehicle").insert(vehicle_data).execute()

        if not vehicle_resp.data:
            raise HTTPException(status_code=400, detail="เพิ่มข้อมูลรถไม่สำเร็จ")

        return {
            "message": "เพิ่มข้อมูลสมาชิกและรถเรียบร้อยแล้ว",
            "member": member_resp.data[0],
            "vehicle": vehicle_resp.data[0],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# แก้ไขข้อมูลสมาชิก พร้อมคืนค่าข้อมูลเก่า
@app.put("/members/{member_id}")
def update_member(member_id: int, data: MemberUpdate):
    try:
        old_resp = (
            supabase.table("Member").select("*").eq("member_id", member_id).execute()
        )
        if not old_resp.data:
            raise HTTPException(status_code=404, detail="ไม่พบสมาชิกในระบบ")

        old_data = old_resp.data[0]
        update_fields = {k: v for k, v in data.dict().items() if v is not None}

        if not update_fields:
            raise HTTPException(status_code=400, detail="ไม่พบข้อมูลที่ต้องการอัปเดต")

        new_resp = (
            supabase.table("Member")
            .update(update_fields)
            .eq("member_id", member_id)
            .execute()
        )

        new_data = new_resp.data[0] if new_resp.data else None

        return {
            "message": "แก้ไขข้อมูลสมาชิกเรียบร้อยแล้ว",
            "old_data": old_data,
            "new_data": new_data,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ลบสมาชิก พร้อมคืนค่าข้อมูลที่ถูกลบ
@app.delete("/members/{member_id}")
def delete_member(member_id: int):
    try:
        old_resp = (
            supabase.table("Member").select("*").eq("member_id", member_id).execute()
        )
        if not old_resp.data:
            raise HTTPException(status_code=404, detail="ไม่พบสมาชิกในระบบ")

        old_data = old_resp.data[0]
        supabase.table("Member").delete().eq("member_id", member_id).execute()

        return {"message": "ลบสมาชิกเรียบร้อยแล้ว", "deleted_data": old_data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ====
#  ROUTES: EVENTS
# ====


# ดึง Event ล่าสุด
@app.get("/events")
def get_events(limit: int = 10):
    data = supabase.table("Event").select("*").limit(limit).execute()
    return data.data


# -------------------------------------------------------------
# 📦 เพิ่ม Event ใหม่ (พร้อมเชื่อมโยง Vehicle)
# -------------------------------------------------------------
@app.post("/events")
def create_event(event: EventIn):
    try:
        vehicle_data = None

        # ตรวจสอบว่ามี vehicle_id หรือ plate ที่ส่งมาหรือไม่
        if event.vehicle_id or event.plate:
            query = supabase.table("Vehicle").select(
                "vehicle_id, plate, province, member_id"
            )

            if event.vehicle_id:
                query = query.eq("vehicle_id", event.vehicle_id)
            elif event.plate:
                query = query.eq("plate", event.plate)

            vehicle_check = query.execute()

            if vehicle_check.data:
                vehicle_data = vehicle_check.data[0]

                # ตรวจสอบว่าข้อมูลจังหวัดตรงไหม
                if (
                    event.province
                    and vehicle_data.get("province")
                    and vehicle_data["province"] != event.province
                ):
                    raise HTTPException(
                        status_code=400,
                        detail="จังหวัดของป้ายทะเบียนไม่ตรงกับข้อมูลในระบบ",
                    )
            else:
                # ถ้าไม่มีในระบบ จะไม่ raise error — บันทึก Event ได้ตามปกติ
                vehicle_data = None

        # ตรวจสอบ direction จาก cam_id
        direction_map = {1: "IN", 2: "OUT"}
        direction = direction_map.get(event.cam_id, "UNKNOWN")

        # เตรียมข้อมูลสำหรับบันทึก Event
        payload = {
            "datetime": event.datetime.isoformat(),
            "plate": event.plate,
            "province": event.province,
            "direction": direction,
            "blob": event.blob,
            "cam_id": event.cam_id,
            "vehicle_id": vehicle_data["vehicle_id"] if vehicle_data else None,
        }

        # บันทึกลง Supabase
        response = supabase.table("Event").insert(payload).execute()

        if not response.data:
            raise HTTPException(status_code=400, detail="เพิ่มข้อมูล Event ไม่สำเร็จ")

        return {
            "message": "เพิ่มข้อมูล Event เรียบร้อยแล้ว",
            "data": response.data[0],
            "vehicle_info": vehicle_data or "ไม่พบข้อมูลรถในระบบ (บันทึกเป็น visitor)",
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาด: {str(e)}")


# ====
#  ROUTES: CHECK PLATE
# ====


# ตรวจสอบทะเบียนรถว่ามีในระบบหรือไม่
@app.get("/check_plate")
def check_plate(
    plate: str | None = Query(None, description="ทะเบียนรถ"),
    province: str | None = Query(None, description="จังหวัด"),
):
    try:
        query = supabase.table("Vehicle").select(
            "vehicle_id, plate, province, member:Member!Vehicle_member_id_fkey(role)"
        )
        if plate:
            query = query.ilike("plate", plate.strip())
        if province:
            query = query.ilike("province", province.strip())

        response = query.execute()
        if response.data:
            vehicle = response.data[0]
            role = vehicle.get("member", {}).get("role", "Visitor")

            return {
                "exists": True,
                "vehicle_id": vehicle.get("vehicle_id"),
                "plate": vehicle.get("plate"),
                "province": vehicle.get("province"),
                "role": role,
            }

        return {"exists": False, "message": "Not registered."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ====
#  ROUTES: DASHBOARD
# ====


# สรุปจำนวนรถเข้าออกต่อวัน
@app.get("/dashboard/summary")
def dashboard_summary(date: str | None = None):
    try:
        date = date or datetime.now().strftime("%Y-%m-%d")
        start, end = f"{date}T00:00:00", f"{date}T23:59:59"

        response = (
            supabase.table("Event")
            .select("event_id, plate, province, direction, vehicle_id")
            .gte("datetime", start)
            .lte("datetime", end)
            .execute()
        )

        events = response.data
        ins = [e for e in events if e["direction"] == "IN"]
        outs = [e for e in events if e["direction"] == "OUT"]
        unknown = [
            e for e in events if not e.get("plate") or e.get("vehicle_id") is None
        ]

        return {
            "date": date,
            "total_events": len(events),
            "in": len(ins),
            "out": len(outs),
            "unknown_or_visitor": len(unknown),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ดึง Event ล่าสุดพร้อม Role และรูปภาพ
@app.get("/dashboard/recent")
def dashboard_recent(limit: int = 10):
    try:
        # ดึงเฉพาะ field ที่ใช้ และใน Vehicle ขอแค่ member_id พอ
        response = (
            supabase.table("Event")
            .select(
                "datetime, plate, province, direction, vehicle_id, blob, Vehicle(member_id)"
            )
            .order("datetime", desc=True)
            .limit(limit)
            .execute()
        )

        results = []
        for e in response.data or []:
            # Vehicle อาจเป็น None/{} หรือ object/list ตามคอนสตรินต์ FK
            vehicle = e.get("Vehicle") or {}
            # ถ้าเป็น list ให้หยิบตัวแรก
            if isinstance(vehicle, list):
                vehicle = vehicle[0] if vehicle else {}

            role = "Visitor"
            member_id = vehicle.get("member_id")
            if member_id:
                member_res = (
                    supabase.table("Member")
                    .select("role")
                    .eq("member_id", member_id)
                    .limit(1)
                    .execute()
                )
                if member_res.data:
                    role = member_res.data[0].get("role") or "Visitor"

            # แปลง blob → data URL base64 (ถ้าเป็น bytes)
            img = e.get("blob")
            if isinstance(img, (bytes, bytearray)):
                try:
                    b64 = base64.b64encode(img).decode("ascii")
                    image_url = f"data:image/jpeg;base64,{b64}"
                except Exception:
                    image_url = None
            else:
                # ถ้าใน DB เก็บเป็น text (เช่น path/URL) ก็ส่งต่อได้
                image_url = img or None

            results.append(
                {
                    "datetime": e.get("datetime"),
                    "plate": e.get("plate") or "-",
                    "province": e.get("province") or "-",
                    "direction": e.get("direction") or "-",
                    "role": role,
                    "image": image_url,
                }
            )

        return {"count": len(results), "data": results}

    except Exception as ex:
        # log ex ไว้ใน server console จะเห็น stacktrace ต้นตอ
        raise HTTPException(status_code=500, detail=str(ex))


# ====
#  ROUTES: UPLOAD IMAGE
# ====


# อัปโหลดรูปภาพไป Supabase Storage
@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        url = upload_image_to_storage(contents, folder="plates")
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ====
#  VIDEO STREAM
# ====
"""
RTSP_URL = "video-_Clipchamp.mp4"
cap = cv2.VideoCapture(RTSP_URL)

if not cap.isOpened():
    raise RuntimeError("Failed to open video source")
"""


def generate_frames():
    while True:
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        _, buffer = cv2.imencode(".jpg", frame)
        frame_bytes = buffer.tobytes()
        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"


@app.get("/video")
def video_feed():
    return StreamingResponse(
        generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame"
    )


# ====
#  HEALTH CHECK
# ====
@app.get("/")
def root():
    return {"status": "ok", "message": "API is running"}
