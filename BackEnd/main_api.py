from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.responses import HTMLResponse
from supabase import create_client
import os
from pydantic import BaseModel
from dotenv import load_dotenv
from datetime import datetime, timedelta
import uuid
import cv2

#  ENV
load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase = create_client(url, key)

#  FASTAPI APP
app = FastAPI()

origins = ["http://localhost:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --ROUTES--


# GET http://127.0.0.1:8000/members
@app.get("/members")
def get_members():
    data = supabase.table("Member").select("*").execute()
    return data.data


# GET http://127.0.0.1:8000/events
@app.get("/events")
def get_events(limit: int = 10):
    data = supabase.table("Event").select("*").limit(limit).execute()
    return data.data


# Model สำหรับรับข้อมูล Event
class EventIn(BaseModel):
    datetime: datetime  # event timestamp
    plate: str | None = None  # license plate
    province: str | None = None  # province
    cam_id: int | None = None  # 1 = IN, 2 = OUT
    blob: str | None = None  # image URL (from Storage)
    vehicle_id: int | None = None


# POST: create Event
@app.post("/events")
def create_event(event: EventIn):
    try:
        direction_map = {1: "IN", 2: "OUT"}
        direction = direction_map.get(event.cam_id, "UNKNOWN")

        response = (
            supabase.table("Event")
            .insert(
                {
                    "datetime": event.datetime.isoformat(),
                    "plate": event.plate,
                    "province": event.province,
                    "direction": direction,
                    "blob": event.blob,
                    "cam_id": event.cam_id,
                    "vehicle_id": event.vehicle_id,
                }
            )
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=400, detail="Insert failed")

        return {"message": "Event created successfully", "data": response.data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# GET: Check plate in member
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
        if response.data and len(response.data) > 0:
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


# Dashboard เอาไว้ดึง summary ไว้ใช้สรุปของนะวันนั้น
@app.get("/dashboard/summary")
def dashboard_summary(date: str | None = None):
    """
    1. รถเข้า/ออกทั้งหมดในวัน
    2. รถที่เข้าอย่างเดียว
    3. รถที่ออกอย่างเดียว
    4. รถที่ไม่มีทะเบียน หรือ ไม่อยู่ในระบบ Member
    """
    try:
        # ถ้าไม่ระบุวันที่ -> ใช้วันปัจจุบัน
        if not date:
            date = datetime.now().strftime("%Y-%m-%d")

        start = f"{date}T00:00:00"
        end = f"{date}T23:59:59"

        # ดึงข้อมูลทั้งหมดของวันนั้น
        response = (
            supabase.table("Event")
            .select("event_id, plate, province, direction, vehicle_id")
            .gte("datetime", start)
            .lte("datetime", end)
            .execute()
        )

        events = response.data

        all_events = len(events)
        ins = [e for e in events if e["direction"] == "IN"]
        outs = [e for e in events if e["direction"] == "OUT"]
        only_in = [e for e in ins if not any(o["plate"] == e["plate"] for o in outs)]
        only_out = [e for e in outs if not any(i["plate"] == e["plate"] for i in ins)]
        unknown = [e for e in events if (not e["plate"]) or (e["vehicle_id"] is None)]

        return {
            "date": date,
            "total_events": all_events,
            "in": len(ins),
            "out": len(outs),
            "only_in": len(only_in),
            "only_out": len(only_out),
            "unknown_or_visitor": len(unknown),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Dashboard เอาไว้ดึง recent event เป็น list 10 อันล่าสุด มี datetime, plate, province, direction, role, image ให้ใช้
@app.get("/dashboard/recent")
def dashboard_recent(limit: int = 10):
    """
    ดึงรายการล่าสุด สำหรับแสดงใน Dashboard
    - แสดงเวลา, ป้ายทะเบียน, จังหวัด, ทิศทาง, role (Staff / Visitor)
    - ถ้ามี blob ภาพ ก็ส่งลิงก์หรือ base64 ไป
    """
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

        events = response.data

        results = []
        for e in events:
            vehicle_info = e.get("Vehicle")
            role = "Visitor"

            # ถ้ามี vehicle_id ให้ไปดึง role จากตาราง Member ผ่าน Vehicle
            if vehicle_info and vehicle_info.get("member_id"):
                member_id = vehicle_info["member_id"]
                member_res = (
                    supabase.table("Member")
                    .select("role")
                    .eq("member_id", member_id)
                    .execute()
                )
                if member_res.data:
                    role = member_res.data[0].get("role", "Visitor")

            # แปลง blob ถ้ามี
            blob_url = None
            if e.get("blob"):
                blob_url = e["blob"]  # ถ้าเก็บเป็นลิงก์ใน Supabase Storage

            results.append(
                {
                    "datetime": e["datetime"],
                    "plate": e.get("plate") or "-",
                    "province": e.get("province") or "-",
                    "direction": e.get("direction") or "-",
                    "role": role,
                    "image": blob_url,
                }
            )

        return {"count": len(results), "data": results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# POST: upload image and return URL
@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    url = upload_image_to_storage(file, folder="plates")
    return {"url": url}



RTSP_URL = "video\\-_Clipchamp.mp4"
cap = cv2.VideoCapture(RTSP_URL)

if not cap.isOpened():
    raise RuntimeError("Failed to open video source")

def generate_frames():
    while True:
        ret, frame = cap.read()

        if not ret:
            print("End of video — restarting...")
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # 👈 กลับไปต้นไฟล์
            continue

        _, buffer = cv2.imencode(".jpg", frame)
        frame_bytes = buffer.tobytes()
        yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n")

@app.get("/video")
def video_feed():
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

