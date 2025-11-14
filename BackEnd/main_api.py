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
from datetime import datetime, timedelta, timezone
import os
import io
import csv
from utils import upload_image_to_storage


# =====
# CONFIGURATION & INITIALIZATION
# =====

try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None


def get_bkk_tz():
    """สร้าง timezone สำหรับ Asia/Bangkok (UTC+7)"""
    if ZoneInfo:
        try:
            return ZoneInfo("Asia/Bangkok")
        except Exception:
            pass
    # fallback ถ้าไม่มี tzdata บนเครื่อง
    return timezone(timedelta(hours=7))


# ENVIRONMENT & DATABASE SETUP
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# สร้าง Supabase client แบบ Global
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# FASTAPI INITIALIZATION
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


class EventIn(BaseModel):
    """Model สำหรับรับข้อมูล Event จาก Worker"""

    datetime: datetime
    plate: str | None = None
    province: str | None = None
    cam_id: int | None = None
    blob: str | None = None
    vehicle_id: int | None = None
    direction: str | None = None


class MemberCreate(BaseModel):
    """Model สำหรับสร้าง Member ใหม่"""

    firstname: str
    lastname: str
    std_id: Optional[Union[int, str]] = None
    faculty: Optional[str] = None
    major: Optional[str] = None
    role: Literal["นักศึกษา", "อาจารย์", "เจ้าหน้าที่", "อื่น ๆ", "อื่นๆ"] = "นักศึกษา"

    @field_validator("std_id")
    @classmethod
    def normalize_std_id(cls, v):
        """แปลง std_id ที่เป็นสตริงตัวเลขให้เป็น int"""
        if v is None:
            return v
        if isinstance(v, str) and v.isdigit():
            return int(v)
        return v

    @model_validator(mode="after")
    def validate_by_role(self):
        """บังคับเงื่อนไขตาม role"""
        if self.role == "นักศึกษา":
            if self.std_id is None or str(self.std_id) == "":
                raise ValueError("std_id is required for role นักศึกษา")
        elif self.role == "อาจารย์":
            self.std_id = None
            self.major = None
        elif self.role == "เจ้าหน้าที่":
            self.std_id = None
            self.faculty = None
            self.major = None
        return self


class VehicleCreate(BaseModel):
    """Model สำหรับสร้าง Vehicle ใหม่"""

    plate: str
    province: str


class RegisterRequest(BaseModel):
    """Model รับข้อมูล Member และ Vehicle พร้อมกัน"""

    member: MemberCreate
    vehicle: VehicleCreate


class MemberUpdate(BaseModel):
    """Model สำหรับอัปเดต Member"""

    firstname: str | None = None
    lastname: str | None = None
    std_id: int | None = None
    faculty: str | None = None
    major: str | None = None
    role: str | None = None


# =====
# ROUTES: WEBSOCKET
# =====


@app.websocket("/ws/events")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint สำหรับ Frontend รับการเชื่อมต่อจาก Client (React)
    และคอยรับการ Broadcast เมื่อมี Event ใหม่
    """
    await manager.connect(websocket)
    try:
        while True:
            # คอยรับข้อความ (ถ้ามี) - ไม่บังคับให้ client ส่งอะไรมา
            data = await websocket.receive_text()
            print(f"[WS] Received from client: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# MANAGER
# =====


class ConnectionManager:
    """Class สำหรับจัดการการเชื่อมต่อ WebSocket"""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """รับการเชื่อมต่อใหม่จาก Client"""
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket connected: {len(self.active_connections)} active client(s)")

    def disconnect(self, websocket: WebSocket):
        """ลบ Client ที่ตัดการเชื่อมต่อออก"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(
                f"WebSocket disconnected: {len(self.active_connections)} active client(s)"
            )

    async def broadcast(self, message: str):
        """ส่งข้อความแจ้งเตือนไปยังทุก Client ที่เชื่อมต่ออยู่"""
        print(f"Broadcast to {len(self.active_connections)} clients: {message}")
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Broadcast error: {e}")


# สร้าง Instance ของ Manager
manager = ConnectionManager()


# =====
# HELPER FUNCTIONS
# =====


def _canon_plate(s: str | None) -> str | None:
    """ตัดช่องว่างทั้งหมดออกจากป้ายทะเบียน"""
    if not s:
        return None
    return "".join(s.split()) or None


def _canon_text(s: str | None) -> str | None:
    """ตัดช่องว่างและทำ lowercase"""
    if not s:
        return None
    return s.strip().lower() or None


def _role_from_plate_province(plate: str | None, province: str | None):
    """หา role จากป้าย/จังหวัด กรณีที่ event ไม่มี vehicle_id หรือ JOIN ไม่เจอ"""
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


# =====
# API ROUTES (HTTP)
# =====


@app.get("/")
def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "API is running"}


# =====
# ROUTES: MEMBERS
# =====


@app.get("/members")
def get_members(
    plate: str | None = Query(None),
    firstname: str | None = Query(None),
    lastname: str | None = Query(None),
):
    """ดึงข้อมูลสมาชิกทั้งหมด พร้อม Join ข้อมูลรถ (รองรับการค้นหา/Filter)"""
    try:
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


@app.post("/members/register")
@app.post("/register")
def register_member_with_vehicle(payload: RegisterRequest):
    """ลงทะเบียนสมาชิกใหม่ พร้อมกับรถ 1 คัน"""
    try:
        # Insert Member
        m_in = payload.member.model_dump(exclude_none=True)
        sid = m_in.get("std_id")
        if isinstance(sid, str) and sid.isdigit():
            m_in["std_id"] = int(sid)

        m_res = supabase.table("Member").insert(m_in).execute()
        if not m_res.data:
            raise HTTPException(status_code=400, detail="เพิ่มข้อมูลสมาชิกไม่สำเร็จ")

        member = m_res.data[0]
        member_id = member["member_id"]

        # Insert Vehicle
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


@app.put("/members/{member_id}")
def update_member(member_id: int, data: MemberUpdate):
    """อัปเดตข้อมูลสมาชิก เฉพาะ field ที่ส่งมา"""
    try:
        # ตรวจสอบว่ามี Member ID นี้จริงหรือไม่
        old_resp = (
            supabase.table("Member").select("*").eq("member_id", member_id).execute()
        )
        if not old_resp.data:
            raise HTTPException(status_code=404, detail="ไม่พบสมาชิกในระบบ")

        # กรองเฉพาะ field ที่ส่งมา
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/members/{member_id}")
def delete_member(member_id: int):
    """ลบสมาชิกและรถที่ผูกอยู่"""
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


# =====
# ROUTES: EVENTS
# =====


@app.get("/events")
def get_events(
    limit: int = Query(1000, ge=1),
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
    direction: str | None = Query(None),
    query: str | None = Query(None, description="Plate query"),
):
    """ดึงข้อมูล Event ทั้งหมด รองรับการกรอง (Filter)"""
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

            # ถ้ายังไม่ได้ role → fallback หาโดย plate+province
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
                    "status": direction_th,
                    "check": check_status,
                    "imgUrl": e.get("blob") or None,
                }
            )

        return results
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Error fetching events: {str(ex)}")


@app.post("/events")
async def create_event(event: EventIn):
    """สร้าง Event ใหม่, บันทึกลง DB, และ Broadcast ไปยัง WebSocket"""
    try:
        # Normalize ค่าที่เข้ามา
        plate_raw = (event.plate or "").strip()
        prov_raw = (event.province or "").strip()
        p_can = _canon_plate(plate_raw)
        prov_can = _canon_text(prov_raw)

        # ตรวจสอบ Vehicle ในระบบ พร้อม role
        vehicle_data = None
        role = None
        if p_can and prov_can:
            guess = (
                supabase.table("Vehicle")
                .select(
                    "vehicle_id, plate, province, member_id, member:Member!Vehicle_member_id_fkey(role)"
                )
                .ilike("plate", f"%{plate_raw}%")
                .ilike("province", f"%{prov_raw}%")
                .limit(20)
                .execute()
            )
            if guess.data:
                vehicle_data = guess.data[0]
                member = vehicle_data.get("member") or {}
                role = member.get("role")

        # ตรวจสอบ direction (ใช้ cam_id เป็น Fallback)
        direction = event.direction or (
            "IN" if event.cam_id == 1 else "OUT" if event.cam_id == 2 else "UNKNOWN"
        )

        # เตรียมข้อมูล (Payload)
        payload = {
            "datetime": event.datetime.isoformat(),
            "plate": event.plate or None,
            "province": event.province or None,
            "direction": direction,
            "blob": event.blob,
            "cam_id": event.cam_id,
            "vehicle_id": vehicle_data["vehicle_id"] if vehicle_data else None,
        }

        # บันทึกลง Supabase
        response = supabase.table("Event").insert(payload).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="เพิ่มข้อมูล Event ไม่สำเร็จ")

        saved_event = response.data[0]

        # สร้างข้อมูลที่จะส่งไปยัง WebSocket (รูปแบบเดียวกับ /dashboard/recent)
        import json

        ws_payload = {
            "datetime": saved_event.get("datetime"),
            "plate": saved_event.get("plate") or "-",
            "province": saved_event.get("province") or "-",
            "direction": saved_event.get("direction") or "-",
            "role": role or "Visitor",
            "image": saved_event.get("blob"),
            "blob": saved_event.get("blob"),  # เผื่อ frontend ใช้ชื่อนี้
        }

        # Broadcast event ใหม่ไปยัง Client แบบ JSON
        await manager.broadcast(json.dumps(ws_payload))

        return {
            "message": "เพิ่มข้อมูล Event เรียบร้อยแล้ว",
            "data": saved_event,
            "vehicle_info": vehicle_data or "ไม่พบข้อมูลรถในระบบ (บันทึกเป็น visitor)",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาด: {str(e)}")


# =====
# ROUTES: CHECK PLATE
# =====


@app.get("/check_plate")
def check_plate(
    plate: str | None = Query(None, description="ทะเบียนรถ"),
    province: str | None = Query(None, description="จังหวัด"),
):
    """ตรวจสอบว่าป้ายทะเบียนนี้มีในระบบ (ตาราง Vehicle) หรือไม่"""
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


# =====
# ROUTES: DASHBOARD
# =====


@app.get("/dashboard/summary")
def dashboard_summary(date: str | None = None):
    """ดึงข้อมูล Stats Cards (ทั้งหมด, เข้า, ออก, ไม่รู้จัก) ของวันที่เลือก"""
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

        # นับและสรุปผล
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


@app.get("/dashboard/recent")
def dashboard_recent(limit: int = 50):
    """ดึง Event ล่าสุด 50 รายการ (พร้อม Role คนนอกหรือคนใน)"""
    try:
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

            # ลองอ่าน role จาก JOIN
            role = (vehicle.get("member") or {}).get("role")

            # ถ้าไม่พบ → หา role จากป้าย/จังหวัด
            if not role:
                role = _role_from_plate_province(e.get("plate"), e.get("province"))

            role = role or "Visitor"

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


BKK = get_bkk_tz()


@app.get("/dashboard/daily")
def dashboard_daily(date: str = Query(..., description="Date in YYYY-MM-DD format")):
    """กราฟรายวัน ดึงสถิติรายชั่วโมง (เข้า/ออก) สำหรับวันที่ระบุ"""
    try:
        # ผู้ใช้เลือก "วันแบบไทย" → ทำเป็นช่วงเวลา local แล้วแปลงเป็น UTC
        start_local = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=BKK)
        end_local = start_local + timedelta(days=1)

        start_utc = start_local.astimezone(timezone.utc).isoformat()
        end_utc = end_local.astimezone(timezone.utc).isoformat()

        # ดึงเหตุการณ์ในช่วง UTC นั้น ๆ
        response = (
            supabase.table("Event")
            .select("datetime, direction")
            .gte("datetime", start_utc)
            .lt("datetime", end_utc)
            .execute()
        )
        events = response.data or []

        # เตรียม bucket 24 ชั่วโมง
        hourly_data = {
            h: {"label": f"{h:02d}:00", "inside": 0, "outside": 0} for h in range(24)
        }

        # เวลาจาก DB เป็น UTC → แปลงเป็นเวลาท้องถิ่น (ไทย) แล้วค่อยนับชั่วโมง
        for e in events:
            dt_utc = datetime.fromisoformat(e["datetime"])
            dt_local = dt_utc.astimezone(BKK)

            hour = dt_local.hour
            direction = (e.get("direction") or "").lower()
            if 0 <= hour < 24:
                if direction == "in":
                    hourly_data[hour]["inside"] += 1
                elif direction == "out":
                    hourly_data[hour]["outside"] += 1

        return [hourly_data[h] for h in range(24)]

    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid date format. Use YYYY-MM-DD."
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500, detail=f"Error in dashboard_daily: {str(ex)}"
        )


# =====
# ROUTES: UPLOAD IMAGE
# =====


@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """อัปโหลดไฟล์ภาพ (blob) ไปยัง Storage"""
    try:
        contents = await file.read()
        url = upload_image_to_storage(contents, folder="plates")
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =====
# ROUTES: EXPORT CSV
# =====


@app.get("/export/events")
def export_events(
    start: str | None = Query(None),
    end: str | None = Query(None),
    direction: str | None = Query(None),
    plate: str | None = Query(None),
):
    """Export ข้อมูล CSV ตาม Filter ที่เลือก"""
    try:
        query_builder = supabase.table("Event").select("*").order("datetime", desc=True)

        if start:
            query_builder = query_builder.gte("datetime", f"{start}T00:00:00")
        if end:
            query_builder = query_builder.lte("datetime", f"{end}T23:59:59")
        if direction and direction.lower() != "all":
            query_builder = query_builder.eq("direction", direction.upper())
        if plate:
            query_builder = query_builder.ilike("plate", f"%{plate.strip()}%")

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

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=events_filtered.csv"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting events: {str(e)}")
