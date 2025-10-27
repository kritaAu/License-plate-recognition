from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
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


# ดึงข้อมูลสมาชิกทั้งหมด
@app.get("/members")
def get_members():
    data = supabase.table("Member").select("*").execute()
    return data.data


# เพิ่มข้อมูลสมาชิกใหม่
@app.post("/members")
def create_member(member: MemberCreate):
    try:
        new_data = member.dict()
        response = supabase.table("Member").insert(new_data).execute()

        if not response.data:
            raise HTTPException(status_code=400, detail="เพิ่มข้อมูลไม่สำเร็จ")

        return {"message": "เพิ่มข้อมูลสมาชิกเรียบร้อยแล้ว", "data": response.data}

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


# เพิ่ม Event ใหม่
@app.post("/events")
def create_event(event: EventIn):
    try:
        direction_map = {1: "IN", 2: "OUT"}
        direction = direction_map.get(event.cam_id, "UNKNOWN")

        payload = {
            "datetime": event.datetime.isoformat(),
            "plate": event.plate,
            "province": event.province,
            "direction": direction,
            "blob": event.blob,
            "cam_id": event.cam_id,
            "vehicle_id": event.vehicle_id,
        }

        response = supabase.table("Event").insert(payload).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="Insert failed")

        return {"message": "Event created successfully", "data": response.data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        response = (
            supabase.table("Event")
            .select(
                "datetime, plate, province, direction, vehicle_id, blob, Vehicle:vehicle_id(*)"
            )
            .order("datetime", desc=True)
            .limit(limit)
            .execute()
        )

        results = []
        for e in response.data:
            role = "Visitor"
            if e.get("Vehicle", {}).get("member_id"):
                member_id = e["Vehicle"]["member_id"]
                member_res = (
                    supabase.table("Member")
                    .select("role")
                    .eq("member_id", member_id)
                    .execute()
                )
                if member_res.data:
                    role = member_res.data[0].get("role", "Visitor")

            results.append(
                {
                    "datetime": e["datetime"],
                    "plate": e.get("plate") or "-",
                    "province": e.get("province") or "-",
                    "direction": e.get("direction") or "-",
                    "role": role,
                    "image": e.get("blob"),
                }
            )

        return {"count": len(results), "data": results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
