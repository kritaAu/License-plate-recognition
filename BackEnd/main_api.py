from fastapi import (
    FastAPI,
    HTTPException,
    UploadFile,
    File,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, Union, Literal
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime, timedelta
import os
import io
import csv
from utils import upload_image_to_storage


# =====
# CONFIGURATION & INITIALIZATION
# =====

# ENVIRONMENT & DATABASE SETUP
# =====
# โหลดตัวแปรจากไฟล์ .env
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# สร้าง Supabase client แบบ Global
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# FASTAPI INITIALIZATION
# =====
# สร้างแอป FastAPI หลัก
app = FastAPI(title="License Plate Recognition API")

# Frontend ที่เชื่อมต่อ (CORS)
origins = ["http://localhost:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====
# PYDANTIC MODELS
# =====


# Model กำหนดโครงสร้างข้อมูล Event ที่รับมาจาก Worker
class EventIn(BaseModel):
    datetime: datetime
    plate: str | None = None
    province: str | None = None
    cam_id: int | None = None
    blob: str | None = None
    vehicle_id: int | None = None
    direction: str | None = None


# Model กำหนดโครงสร้างข้อมูล Member สำหรับการสร้างสมาชิกใหม่
class MemberCreate(BaseModel):
    firstname: str
    lastname: str
    std_id: Optional[Union[int, str]] = None
    faculty: Optional[str] = None
    major: Optional[str] = None
    role: Literal["นักศึกษา", "อาจารย์", "เจ้าหน้าที่", "อื่น ๆ", "อื่นๆ"] = "นักศึกษา"

    # แปลง std_id ที่เป็นสตริงตัวเลขให้เป็น int อัตโนมัติ
    @field_validator("std_id")
    @classmethod
    def normalize_std_id(cls, v):
        if v is None:
            return v
        if isinstance(v, str) and v.isdigit():
            return int(v)
        return v

    # บังคับเงื่อนไขตาม role
    @model_validator(mode="after")
    def validate_by_role(self):
        if self.role == "นักศึกษา":
            # นักศึกษา ต้องมี std_id และ (ถ้าต้องการ) major
            if self.std_id is None or str(self.std_id) == "":
                raise ValueError("std_id is required for role นักศึกษา")
            # ถ้าต้องการให้ 'major' บังคับด้วย ให้ปลดคอมเมนต์บรรทัดถัดไป
            # if not (self.major and self.major.strip()):
            #     raise ValueError("major is required for role นักศึกษา")
        elif self.role == "อาจารย์":
            self.std_id = None
            self.major = None
        elif self.role == "เจ้าหน้าที่":
            self.std_id = None
            self.faculty = None
            self.major = None
        return self


# Model กำหนดโครงสร้างข้อมูล Vehicle สำหรับการสร้างรถใหม่
class VehicleCreate(BaseModel):
    plate: str
    province: str


# Model รับข้อมูล Member และ Vehicle พร้อมกันใน Request เดียว
class RegisterRequest(BaseModel):
    member: MemberCreate
    vehicle: VehicleCreate


# Model กำหนดโครงสร้างข้อมูลสำหรับอัปเดต Member
class MemberUpdate(BaseModel):
    firstname: str | None = None
    lastname: str | None = None
    std_id: int | None = None
    faculty: str | None = None
    major: str | None = None
    role: str | None = None


# =====
# WEBSOCKET MANAGER
# =====
# Class คลาสสำหรับจัดการการเชื่อมต่อ WebSocket ทั้งหมด
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    # Method รับการเชื่อมต่อใหม่จาก Client
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket connected: {len(self.active_connections)} active client(s)")

    # Method ลบ Client ที่ตัดการเชื่อมต่อออก
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(
                f"WebSocket disconnected: {len(self.active_connections)} active client(s)"
            )

    # Method ส่งข้อความแจ้งเตือน ไปยังทุก Client ที่เชื่อมต่ออยู่
    async def broadcast(self, message: str):
        print(f"Broadcast to {len(self.active_connections)} clients: {message}")
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Broadcast error: {e}")


# สร้าง Instance ของ Manager เพื่อใช้งานจริง
manager = ConnectionManager()


# =====
# HELPER FUNCTIONS
# =====


# หา role จากป้าย/จังหวัด กรณี event ไม่มี vehicle_id หรือ JOIN ไม่เจอ
def _role_from_plate_province(plate: str | None, province: str | None):
    if not plate or not province:
        return None
    try:
        res = (
            supabase.table("Vehicle")
            .select("member:Member!Vehicle_member_id_fkey(role)")
            .ilike("plate", str(plate).strip())
            .ilike("province", str(province).strip())
            .limit(1)
            .execute()
        )
        if res.data:
            member = res.data[0].get("member") or {}
            return member.get("role")
    except Exception:
        pass
    return None


# Endpoint สำหรับ batch_process สร้าง Event ใหม่, บันทึกลง DB, และ Broadcast ไปยัง WebSocket
def normalize_plate(s: str | None) -> str | None:
    # ตัดช่องว่างทั้งหมดออก (กันเคส "1ลบ521" vs "1ลบ 521")
    return "".join(str(s or "").split()) or None


# =====
# API ROUTES (HTTP)
# =====


# HEALTH CHECK
# =====
# Endpoint ตรวจสอบว่า API ทำงานอยู่
@app.get("/")
def root():
    return {"status": "ok", "message": "API is running"}


# ROUTES: MEMBERS (จัดการข้อมูลสมาชิก)
# =====
# Endpoint ดึงข้อมูลสมาชิกทั้งหมด (สำหรับหน้า Member) พร้อม Join ข้อมูลรถ (รองรับการค้นหา/Filter)
@app.get("/members")
def get_members(
    # Query Parameters สำหรับรับค่าจาก Frontend
    plate: str | None = Query(
        None,
    ),
    firstname: str | None = Query(
        None,
    ),
    lastname: str | None = Query(
        None,
    ),
):
    try:
        # สร้าง Query Builder
        query_builder = supabase.table("Member").select(
            "member_id, firstname, lastname, std_id, faculty, major, role, Vehicle(plate, province)"
        )

        # Filtering
        if firstname:
            query_builder = query_builder.ilike("firstname", f"%{firstname.strip()}%")

        if lastname:
            query_builder = query_builder.ilike("lastname", f"%{lastname.strip()}%")

        if plate:
            query_builder = query_builder.ilike("Vehicle.plate", f"%{plate.strip()}%")

        # ดึงข้อมูล
        response = query_builder.execute()

        # Map ข้อมูล
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


# Endpoint ลงทะเบียนสมาชิกใหม่ พร้อมกับรถ 1 คัน
@app.post("/members/register")
@app.post("/register")
def register_member_with_vehicle(payload: RegisterRequest):
    try:
        # member
        m_in = payload.member.model_dump(exclude_none=True)

        sid = m_in.get("std_id")
        if isinstance(sid, str) and sid.isdigit():
            m_in["std_id"] = int(sid)

        m_res = supabase.table("Member").insert(m_in).execute()
        if not m_res.data:
            raise HTTPException(status_code=400, detail="เพิ่มข้อมูลสมาชิกไม่สำเร็จ")

        member = m_res.data[0]
        member_id = member["member_id"]

        # vehicle
        v_in = payload.vehicle.model_dump(exclude_none=True)
        v_in["member_id"] = member_id
        v_res = supabase.table("Vehicle").insert(v_in).execute()

        if not v_res.data:
            supabase.table("Member").delete().eq("member_id", member_id).execute()
            raise HTTPException(
                status_code=400, detail="เพิ่มข้อมูลรถไม่สำเร็จ (Member ถูก Rollback)"
            )

        vehicle = v_res.data[0]
        row = {
            "member_id": member_id,
            "std_id": member.get("std_id"),
            "firstname": member.get("firstname"),
            "lastname": member.get("lastname"),
            "plate": vehicle.get("plate"),
            "province": vehicle.get("province"),
        }
        return {"message": "เพิ่มข้อมูลสมาชิกและรถเรียบร้อยแล้ว", "row": row}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Endpoint อัปเดตข้อมูลสมาชิก เฉพาะ field ที่ส่งมา
@app.put("/members/{member_id}")
def update_member(member_id: int, data: MemberUpdate):
    try:
        # ตรวจสอบว่ามี Member ID นี้จริงหรือไม่
        old_resp = (
            supabase.table("Member").select("*").eq("member_id", member_id).execute()
        )
        if not old_resp.data:
            raise HTTPException(status_code=404, detail="ไม่พบสมาชิกในระบบ")

        # กรองเฉพาะ field ที่ส่งมา ไม่เอา None
        update_fields = data.model_dump(exclude_none=True)
        if not update_fields:
            raise HTTPException(status_code=400, detail="ไม่พบข้อมูลที่ต้องการอัปเดต")

        # สั่งอัปเดต
        new_resp = (
            supabase.table("Member")
            .update(update_fields)
            .eq("member_id", member_id)
            .execute()
        )
        new_data = new_resp.data[0] if new_resp.data else None

        return {
            "message": "แก้ไขข้อมูลสมาชิกเรียบร้อยแล้ว",
            "old_data": old_resp.data[0],
            "new_data": new_data,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Endpoint ลบสมาชิกและรถที่ผูกอยู่
@app.delete("/members/{member_id}")
def delete_member(member_id: int):
    try:
        # ตรวจสอบว่ามี Member ID นี้จริงหรือไม่
        old_resp = (
            supabase.table("Member").select("*").eq("member_id", member_id).execute()
        )
        if not old_resp.data:
            raise HTTPException(status_code=404, detail="ไม่พบสมาชิกในระบบ")

        # ลบ Vehicle ที่ผูกอยู่ก่อน
        supabase.table("Vehicle").delete().eq("member_id", member_id).execute()

        # ลบ Member
        supabase.table("Member").delete().eq("member_id", member_id).execute()

        return {
            "message": "ลบสมาชิกและรถที่ผูกอยู่เรียบร้อยแล้ว",
            "deleted_data": old_resp.data[0],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ROUTES: EVENTS (จัดการเหตุการณ์)
# =====
# Endpoint หน้า Search/Home ดึงข้อมูล Event ทั้งหมด รองรับการกรอง (Filter) ตามวันที่, ทิศทาง, และป้ายทะเบียน
@app.get("/events")
def get_events(
    limit: int = Query(1000, ge=1),
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
    direction: str | None = Query(None),
    query: str | None = Query(None, description="Plate query"),
):
    try:
        qb = (
            supabase.table("Event")
            .select(
                "datetime, plate, province, direction, blob, vehicle_id,"
                "Vehicle!Event_vehicle_id_fkey(member:Member!Vehicle_member_id_fkey(role))"
            )
            .order("datetime", desc=True)
            .limit(limit)
        )

        # Filters
        if start_date:
            qb = qb.gte("datetime", f"{start_date}T00:00:00")
        if end_date:
            qb = qb.lte("datetime", f"{end_date}T23:59:59")
        if direction and direction.lower() != "all":
            qb = qb.eq("direction", direction.upper())
        if query:
            qb = qb.ilike("plate", f"%{query.strip()}%")

        resp = qb.execute()

        # แผนที่ทิศทาง -> ไทย
        dir_th = {"IN": "เข้า", "OUT": "ออก"}

        results = []
        for e in resp.data or []:
            # ดึง role จาก join ก่อน
            vehicle = e.get("Vehicle") or {}
            if isinstance(vehicle, list):
                vehicle = vehicle[0] if vehicle else {}
            member_obj = vehicle.get("member") or {}
            if isinstance(member_obj, list):
                member_obj = member_obj[0] if member_obj else {}
            role = member_obj.get("role")

            # ถ้ายังไม่ได้ role (เช่น event เก่าที่ไม่มี vehicle_id) → fallback หาโดย plate+province
            if not role:
                role = _role_from_plate_province(e.get("plate"), e.get("province"))

            check_status = (
                "บุคคลภายนอก"
                if not role or str(role).lower() == "visitor"
                else "บุคคลภายใน"
            )

            direction_en = (e.get("direction") or "").upper()
            direction_th = dir_th.get(direction_en, "ไม่ทราบ")

            results.append(
                {
                    "time": e.get("datetime"),
                    "plate": e.get("plate") or "-",
                    "province": e.get("province") or "-",
                    "status": direction_th,  # ทิศทางเป็นไทย
                    "check": check_status,  # คนใน/คนนอก
                    "imgUrl": e.get("blob") or None,
                }
            )

        return results
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Error fetching events: {str(ex)}")


@app.post("/events")
async def create_event(event: EventIn):
    try:
        vehicle_data = None

        # --- ตรวจสอบ Vehicle ในระบบ: ยืดหยุ่นขึ้น ---
        plate_norm = normalize_plate(event.plate)
        prov = (event.province or "").strip()

        if plate_norm:
            # 1) พยายาม exact match ก่อน (ถ้ามี province)
            if prov:
                exact = (
                    supabase.table("Vehicle")
                    .select("vehicle_id, plate, province, member_id")
                    .eq("plate", (event.plate or "").strip())
                    .eq("province", prov)
                    .limit(1)
                    .execute()
                )
                if exact.data:
                    vehicle_data = exact.data[0]

            # 2) ถ้ายังไม่เจอ -> ค้นแบบคลุมเครือ: plate ไม่สนช่องว่าง / province ไม่บังคับ
            if not vehicle_data:
                like_q = (
                    supabase.table("Vehicle").select(
                        "vehicle_id, plate, province, member_id"
                    )
                    # ค้นหา plate แบบ ilike ด้วย plate ที่ตัดช่องว่างแล้ว
                    .ilike("plate", f"%{plate_norm}%")
                )
                if prov:
                    like_q = like_q.ilike("province", f"%{prov}%")
                like_res = like_q.limit(1).execute()
                if like_res.data:
                    vehicle_data = like_res.data[0]

        # --- ตรวจสอบ direction (fallback ตามเดิม) ---
        direction = event.direction or (
            "IN" if event.cam_id == 1 else "OUT" if event.cam_id == 2 else "UNKNOWN"
        )

        # --- เตรียม payload และบันทึก ---
        payload = {
            "datetime": event.datetime.isoformat(),
            "plate": event.plate or None,
            "province": event.province or None,
            "direction": direction,
            "blob": event.blob,
            "cam_id": event.cam_id,
            "vehicle_id": vehicle_data["vehicle_id"] if vehicle_data else None,
        }

        response = supabase.table("Event").insert(payload).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="เพิ่มข้อมูล Event ไม่สำเร็จ")

        # แจ้ง realtime ไปหน้าเว็บตามเดิม
        message = f"Event ใหม่: {event.plate or 'ไม่ทราบทะเบียน'} ({direction})"
        await manager.broadcast(message)

        return {
            "message": "เพิ่มข้อมูล Event เรียบร้อยแล้ว",
            "data": response.data[0],
            "vehicle_info": vehicle_data or "ไม่พบข้อมูลรถในระบบ (บันทึกเป็น visitor)",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาด: {str(e)}")


# ROUTES: CHECK PLATE
# ===
# Endpoint สำหรับ batch_process ตรวจสอบว่าป้ายทะเบียนนี้มีในระบบ (ตาราง Vehicle) หรือไม่
@app.get("/check_plate")
def check_plate(
    plate: str | None = Query(None, description="ทะเบียนรถ"),
    province: str | None = Query(None, description="จังหวัด"),
):
    try:
        # Join เพื่อดึง Role มาด้วย
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


# ROUTES: DASHBOARD
# =====
# Endpoint หน้า Home ดึงข้อมูล Stats Cards (ทั้งหมด, เข้า, ออก, ไม่รู้จัก) ของวันที่เลือก
@app.get("/dashboard/summary")
def dashboard_summary(date: str | None = None):
    try:
        # ถ้าไม่ส่งวันที่มา ให้ใช้วันที่ปัจจุบัน
        date = date or datetime.now().strftime("%Y-%m-%d")
        start, end = f"{date}T00:00:00", f"{date}T23:59:59"

        # ดึงข้อมูล Event เฉพาะวันนั้น
        response = (
            supabase.table("Event")
            .select("event_id, plate, province, direction, vehicle_id")
            .gte("datetime", start)
            .lte("datetime", end)
            .execute()
        )
        events = response.data

        # นับและสรุปผล (Aggregation ใน Python)
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


# Endpoint สำหรับหน้า Home ดึง Event ล่าสุด 50 รายการ (พร้อม Role คนนอกหรือคนใน)
@app.get("/dashboard/recent")
def dashboard_recent(limit: int = 50):
    try:
        # (N+1 Query Fix) Join เพื่อดึง Role มาใน Query เดียว
        response = (
            supabase.table("Event")
            .select(
                "datetime, plate, province, direction, blob,"
                "Vehicle!Event_vehicle_id_fkey(member:Member!Vehicle_member_id_fkey(role))"
            )
            .order("datetime", desc=True)
            .limit(limit)
            .execute()
        )

        results = []
        for e in response.data or []:
            vehicle = e.get("Vehicle") or {}
            if isinstance(vehicle, list):
                vehicle = vehicle[0] if vehicle else {}

            # 1) ลองอ่าน role จาก JOIN (vehicle_id)
            role = (vehicle.get("member") or {}).get("role")

            # 2) ถ้าไม่พบ (เช่น vehicle_id ว่าง) → หา role จากป้าย/จังหวัด
            if not role:
                role = _role_from_plate_province(e.get("plate"), e.get("province"))

            role = role or "Visitor"  # fallback สุดท้าย

            results.append(
                {
                    "datetime": e.get("datetime"),
                    "plate": e.get("plate") or "-",
                    "province": e.get("province") or "-",
                    "direction": e.get("direction") or "-",
                    "role": role,
                    "image": e.get("blob") or None,
                }
            )

        return {"count": len(results), "data": results}
    except Exception as ex:
        raise HTTPException(
            status_code=500, detail=f"Error in dashboard_recent: {str(ex)}"
        )


# Endpoint หน้า Home - กราฟรายวัน ดึงสถิติรายชั่วโมง (เข้า/ออก) สำหรับวันที่ระบุ
@app.get("/dashboard/daily")
def dashboard_daily(date: str = Query(..., description="Date in YYYY-MM-DD format")):
    try:
        # วิเคราะห์วันที่และกำหนดช่วงเวลา
        start_date = datetime.strptime(date, "%Y-%m-%d")
        end_date = start_date + timedelta(days=1)

        # ดึงข้อมูลเหตุการณ์ทั้งหมดของวันนั้น
        response = (
            supabase.table("Event")
            .select("datetime, direction")
            .gte("datetime", start_date.isoformat())
            .lt("datetime", end_date.isoformat())
            .execute()
        )
        events = response.data

        # กำหนดค่าเริ่มต้นให้ชุดข้อมูลรายชั่วโมง (24 ชั่วโมง)
        hourly_data = {}
        for h in range(24):
            hour_str = f"{h:02d}:00"
            hourly_data[h] = {"label": hour_str, "inside": 0, "outside": 0}

        # สรุปผลเหตุการณ์ ด้วย Python
        for event in events:
            event_dt = datetime.fromisoformat(event["datetime"])
            hour = event_dt.hour
            direction = event.get("direction", "").lower()

            if 0 <= hour < 24:
                if direction == "in":
                    hourly_data[hour]["inside"] += 1
                elif direction == "out":
                    hourly_data[hour]["outside"] += 1

        # แปลง Dictionary ให้เป็น List
        result_series = [hourly_data[h] for h in range(24)]

        return result_series

    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid date format. Use YYYY-MM-DD."
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500, detail=f"Error in dashboard_daily: {str(ex)}"
        )


# ROUTES: UPLOAD IMAGE
# =====
# Endpoint สำหรับ batch_process อัปโหลดไฟล์ภาพ (blob) ไปยัง Storage
@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        url = upload_image_to_storage(contents, folder="plates")
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ROUTES: EXPORT CSV
# =====
# Endpoint หน้า Search Export ข้อมูล CSV ตาม Filter ที่เลือก
@app.get("/export/events")
def export_events(
    start: str | None = Query(None),
    end: str | None = Query(None),
    direction: str | None = Query(None),
    plate: str | None = Query(None),
):
    try:
        # สร้าง Query Builder โดยใช้ Filter
        query_builder = supabase.table("Event").select("*").order("datetime", desc=True)

        if start:
            query_builder = query_builder.gte("datetime", f"{start}T00:00:00")
        if end:
            query_builder = query_builder.lte("datetime", f"{end}T23:59:59")
        if direction and direction.lower() != "all":
            query_builder = query_builder.eq("direction", direction.upper())
        if plate:
            query_builder = query_builder.ilike("plate", f"%{plate.strip()}%")

        # ดึงข้อมูล
        response = query_builder.execute()
        data = response.data or []

        # สร้างไฟล์ CSV ใน Memory
        output = io.StringIO(newline="")
        output.write("\ufeff")  # UTF-8 BOM (สำหรับ Excel อ่านไทย)

        fieldnames = (
            list(data[0].keys())
            if data
            else ["datetime", "plate", "province", "direction"]
        )
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        if data:
            writer.writerows(data)
        output.seek(0)

        # ส่งไฟล์ CSV กลับไป
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=events_filtered.csv"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting events: {str(e)}")


# WEBSOCKET ROUTES
# =====
# Endpoint สำหรับ Frontend รับการเชื่อมต่อ WebSocket จาก Client (React) และค้างไว้เพื่อรอรับการ Broadcast
@app.websocket("/ws/events")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # คอยรับข้อความ (ถ้ามี)
            data = await websocket.receive_text()
            print(f"[WS] Received from client: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
