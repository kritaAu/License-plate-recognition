from fastapi import FastAPI, HTTPException
from supabase import create_client
import os
from pydantic import BaseModel
from dotenv import load_dotenv
from datetime import datetime

# โหลด environment
load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase = create_client(url, key)

# สร้าง FastAPI app
app = FastAPI()

# -------------------- ROUTES --------------------

# ดึงข้อมูลสมาชิก
# GET http://127.0.0.1:8000/members
@app.get("/members")
def get_members():
    data = supabase.table("Member").select("*").execute()
    return data.data


# ดึง event ทั้งหมด
# GET http://127.0.0.1:8000/events
@app.get("/events")
def get_events(limit: int = 10):
    data = supabase.table("Event").select("*").limit(limit).execute()
    return data.data


# Model สำหรับรับข้อมูล Event
class EventIn(BaseModel):
    status: str          # "in" หรือ "out"
    datetime: datetime   # เวลาที่จับได้
    plate: str           # เลขทะเบียน
    province: str        # จังหวัด
    direction: str       # "เข้า" หรือ "ออก"
    blob: dict | None = None  # เก็บผลลัพธ์ raw (เช่น bounding box)
    cam_id: int | None = None 

# POST: เพิ่ม Event
# POST http://127.0.0.1:8000/events
@app.post("/events")
def create_event(event: EventIn):
    try:
        response = supabase.table("Event").insert({
            "status": event.status,#Visitor,Student,Teacher,Staff
            "datetime": event.datetime.isoformat(),
            "plate": event.plate,
            "province": event.province,
            "direction": event.direction,
            "blob": event.blob,
            "cam_id":event.cam_id
        }).execute()

        if not response.data:
            raise HTTPException(status_code=400, detail="Insert failed")

        return {"message": "✅ Event created successfully", "data": response.data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
