# ===
#  1. IMPORTS (ส่วนนำเข้า Library)
# ===
from fastapi import (
    FastAPI,
    HTTPException,
    UploadFile,
    File,
    Query,
    WebSocket,
    WebSocketDisconnect,
    Depends,
    status,
    Request,
    Form,
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, Union, Literal, List, Dict, Any
from passlib.context import CryptContext
import os
import io
import csv
import re
import time
from contextlib import asynccontextmanager
from functools import lru_cache

# Libs for Auth & Time
from supabase import create_client, Client
from dotenv import load_dotenv
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
import jwt

# Local Utilities
from utils import upload_image_to_storage

# ===
#  2. LOGGING, TIMEZONE, AND CONFIGURATION
# ===
import logging

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# 🌟 (แก้ไข) ย้าย Timezone มาไว้ด้านบนสุด
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
    return timezone(timedelta(hours=7))


# 🌟 (แก้ไข) สร้าง BKK ทันที เพื่อให้ Model (EventIn) ใช้งานได้
BKK = get_bkk_tz()

# ENVIRONMENT & DATABASE SETUP
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# สร้าง Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ===
#  3. FASTAPI INITIALIZATION & CORS
# ===
app = FastAPI(title="License Plate Recognition API")

origins = ["http://localhost:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===
#  4. SECURITY & AUTHENTICATION (JWT)
# ===
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 ชั่วโมง

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


# --- Auth Helper Functions ---
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """ตรวจสอบ password"""
    # ตัดให้ไม่เกิน 72 bytes ตาม bcrypt requirement
    if len(plain_password.encode("utf-8")) > 72:
        plain_password = plain_password.encode("utf-8")[:72].decode(
            "utf-8", errors="ignore"
        )
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash password สำหรับสร้าง user ใหม่"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    """สร้าง JWT token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def authenticate_user(username: str, password: str):
    """ตรวจสอบ username และ password (จาก Supabase)"""
    # 1. ค้นหา User ในตาราง "Users"
    response = (
        supabase.table("Users")
        .select("username, hashed_password, role")
        .eq("username", username)
        .limit(1)
        .execute()
    )

    if not response.data:
        return False  # ไม่พบ User

    user = response.data[0]

    # 2. ตรวจสอบรหัสผ่าน (เหมือนเดิม)
    if not verify_password(password, user["hashed_password"]):
        return False

    return user


# 🌟 (แก้ไขฟังก์ชันนี้)
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """(Dependency) ดึงข้อมูล user ปัจจุบันจาก Token (และค้นหาใน Supabase)"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="ไม่สามารถยืนยันตัวตนได้",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    # 🌟 (ส่วนที่แก้ไข)
    # ค้นหา User ใน Supabase ด้วย username ที่ได้จาก Token
    response = (
        supabase.table("Users")
        .select("username, role")
        .eq("username", username)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise credentials_exception  # ไม่พบ User ใน DB (อาจถูกลบไปแล้ว)

    user = response.data[0]
    return user


async def get_current_admin_user(current_user: dict = Depends(get_current_user)):
    """(Dependency) ตรวจสอบว่าเป็น Admin หรือไม่"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="ไม่มีสิทธิ์เข้าถึง")
    return current_user


# ===
#  5. PYDANTIC MODELS (ตัวตรวจสอบข้อมูล)
# ===


# --- Models สำหรับ Auth ---
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# --- Models สำหรับ API ---
class EventIn(BaseModel):
    """(Model) กำหนดโครงสร้างข้อมูล Event ที่รับมาจาก Worker (watch_folder.py)"""

    datetime: datetime
    plate: str | None = None
    province: str | None = None
    cam_id: int | None = None
    blob: str | None = None
    vehicle_id: int | None = None
    direction: str | None = None

    @field_validator("datetime")
    @classmethod
    def localize_datetime(cls, v: datetime) -> datetime:
        """ตรวจสอบว่าถ้าเวลาที่ส่งมาไม่มี timezone ให้ assume ว่าเป็น Bangkok (BKK)"""
        if v.tzinfo is None:
            # BKK ถูก define ไว้ด้านบนสุดของไฟล์แล้ว
            return v.replace(tzinfo=BKK)
        return v


class MemberCreate(BaseModel):
    """(Model) กำหนดโครงสร้างข้อมูล Member สำหรับการสร้างสมาชิกใหม่"""

    firstname: str
    lastname: str
    std_id: Optional[Union[int, str]] = None
    faculty: Optional[str] = None
    major: Optional[str] = None
    role: Literal["นักศึกษา", "อาจารย์", "เจ้าหน้าที่", "อื่น ๆ", "อื่นๆ"] = "นักศึกษา"
    # (Validators อยู่ในไฟล์เดิมของคุณ)


class VehicleCreate(BaseModel):
    """(Model) กำหนดโครงสร้างข้อมูล Vehicle สำหรับการสร้างรถใหม่"""

    plate: str
    province: str


class RegisterRequest(BaseModel):
    """(Model) รับข้อมูล Member และ Vehicle พร้อมกันใน Request เดียว"""

    member: MemberCreate
    vehicle: VehicleCreate


class MemberUpdate(BaseModel):
    """(Model) กำหนดโครงสร้างข้อมูลสำหรับอัปเดต Member (ทุก Field เป็น Optional)"""

    firstname: str | None = None
    lastname: str | None = None
    std_id: int | None = None
    faculty: str | None = None
    major: str | None = None
    role: str | None = None


# ===
#  6. WEBSOCKET MANAGER
# ===
class ConnectionManager:
    """(Class) คลาสสำหรับจัดการการเชื่อมต่อ WebSocket ทั้งหมด"""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """(Method) รับการเชื่อมต่อใหม่จาก Client"""
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket connected: {len(self.active_connections)} active client(s)")

    def disconnect(self, websocket: WebSocket):
        """(Method) ลบ Client ที่ตัดการเชื่อมต่อออก"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(
                f"WebSocket disconnected: {len(self.active_connections)} active client(s)"
            )

    async def broadcast(self, message: str):
        """(Method) ส่งข้อความ (แจ้งเตือน) ไปยังทุก Client ที่เชื่อมต่ออยู่"""
        print(f"📡 Broadcast to {len(self.active_connections)} clients: {message}")
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Broadcast error: {e}")


# สร้าง Instance ของ Manager เพื่อใช้งานจริง
manager = ConnectionManager()


# ===
#  7. API HELPER FUNCTIONS (สำหรับ API)
# ===
def _canon_plate(s: str | None) -> str | None:
    if not s:
        return None
    return "".join(s.split()) or None


def _canon_text(s: str | None) -> str | None:
    if not s:
        return None
    return s.strip().lower() or None


def _role_from_plate_province(plate: str | None, province: str | None):
    """Helper: ค้นหา Role จากป้ายทะเบียน (ใช้เป็น Fallback)"""
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


# ===
#  8. ROUTES: AUTHENTICATION (จัดการ Login/Logout)
# ===


@app.post("/api/auth/login", response_model=LoginResponse)
def login(request: LoginRequest):
    """(Endpoint) Endpoint สำหรับ Login"""
    user = authenticate_user(request.username, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"username": user["username"], "role": user["role"]},
    }


@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """(Endpoint) ดึงข้อมูล user ปัจจุบัน (ต้องใช้ Token)"""
    return {"username": current_user["username"], "role": current_user["role"]}


@app.post("/api/auth/create-user")
async def create_user(
    username: str = Form(...),
    password: str = Form(...),
    role: str = Form("staff"),
    _current_admin: dict = Depends(get_current_admin_user),  # 👈 (ต้องเป็น Admin)
):
    """(Endpoint) สร้าง user ใหม่ (เฉพาะ Admin)"""
    if username in USERS_DB:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="ชื่อผู้ใช้นี้มีอยู่แล้ว"
        )
    hashed_password = get_password_hash(password)
    USERS_DB[username] = {
        "username": username,
        "hashed_password": hashed_password,
        "role": role,
    }
    return {"message": f"สร้างผู้ใช้ {username} สำเร็จ"}


# ===
#  9. ROUTES: WEBSOCKET (จัดการเชื่อมต่อ Real-Time)
# ===
@app.websocket("/ws/events")
async def websocket_endpoint(websocket: WebSocket):
    """(Endpoint) รับการเชื่อมต่อ WebSocket จาก Frontend"""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            print(f"[WS] Received from client: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ===
#  10. ROUTES: MEMBERS (จัดการข้อมูลสมาชิก)
# ===
# 🌟 (สำคัญ) Endpoint ทั้งหมดในส่วนนี้ "ควรจะ" ถูกป้องกันด้วย Depends(get_current_user)
# 🌟 แต่เพื่อความง่าย ผมจะยังไม่เพิ่มเข้าไปก่อน


@app.get("/members")
def get_members(
    plate: str | None = Query(None),
    firstname: str | None = Query(None),
    lastname: str | None = Query(None),
    # _user: dict = Depends(get_current_user) # 👈 (ควรเพิ่มทีหลัง)
):
    """(Endpoint) ดึงข้อมูลสมาชิกทั้งหมด (สำหรับหน้า Member) พร้อม Filter"""
    try:
        query_builder = supabase.table("Member").select(
            "member_id, firstname, lastname, std_id, faculty, major, role, Vehicle(plate, province)"
        )
        if firstname:
            query_builder = query_builder.ilike("firstname", f"%{firstname.strip()}%")
        if lastname:
            query_builder = query_builder.ilike("lastname", f"%{lastname.strip()}%")
        if plate:
            query_builder = query_builder.ilike("Vehicle.plate", f"%{plate.strip()}%")

        response = query_builder.execute()

        # ... (โค้ด Map ข้อมูล members เหมือนเดิม) ...
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
def register_member_with_vehicle(
    payload: RegisterRequest,
    # _user: dict = Depends(get_current_user) # 👈 (ควรเพิ่มทีหลัง)
):
    """(Endpoint) ลงทะเบียนสมาชิกใหม่ พร้อมกับรถ 1 คัน"""
    try:
        # ... (โค้ด Logic การ Insert Member และ Vehicle เหมือนเดิม) ...
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
        row = {
            "member_id": member_id,
            "std_id": member.get("std_id"),
            "firstname": member.get("firstname"),
            "lastname": member.get("lastname"),
            "plate": vehicle.get("plate"),
            "province": vehicle.get("province"),
        }
        return {"message": "เพิ่มข้อมูลสมาชิกและรถเรียบร้อยแล้ว", "row": row}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/members/{member_id}")
def delete_member(
    member_id: int,
    # _user: dict = Depends(get_current_admin_user) # 👈 (ควรเพิ่มทีหลัง - เฉพาะ Admin)
):
    """(Endpoint) ลบสมาชิก (และรถที่ผูกอยู่)"""
    try:
        # ... (โค้ด Logic การลบ Member และ Vehicle เหมือนเดิม) ...
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


# ===
#  11. ROUTES: EVENTS (จัดการเหตุการณ์)
# ===


@app.get("/events")
def get_events(
    limit: int = Query(1000, ge=1),
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
    direction: str | None = Query(None),
    query: str | None = Query(None, description="Plate query"),
    # _user: dict = Depends(get_current_user) # 👈 (ควรเพิ่มทีหลัง)
):
    """(Endpoint) ดึงข้อมูล Event ทั้งหมด รองรับการกรอง (Filter) (สำหรับหน้า Search/Home)"""
    try:
        # ... (โค้ด Query Builder และ Map ข้อมูลเหมือนเดิม) ...
        qb = (
            supabase.table("Event")
            .select(
                "datetime, plate, province, direction, blob, vehicle_id,"
                "Vehicle!Event_vehicle_id_fkey(member:Member!Vehicle_member_id_fkey(role))"
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
            member_obj = vehicle.get("member") or {}
            if isinstance(member_obj, list):
                member_obj = member_obj[0] if member_obj else {}
            role = member_obj.get("role")

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
async def create_event(
    event: EventIn,
    # _user: dict = Depends(get_current_user) # 👈 (ควรเพิ่มทีหลัง - หรือใช้ API Key)
):
    """(Endpoint) (สำหรับ Worker) สร้าง Event ใหม่, บันทึกลง DB, และ Broadcast"""
    try:
        # ... (โค้ด Logic การ Normalize, ค้นหา Vehicle, สร้าง Payload, Insert, Broadcast เหมือนเดิม) ...
        plate_raw = (event.plate or "").strip()
        prov_raw = (event.province or "").strip()
        p_can = _canon_plate(plate_raw)
        prov_can = _canon_text(prov_raw)

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

        direction = event.direction or (
            "IN" if event.cam_id == 1 else "OUT" if event.cam_id == 2 else "UNKNOWN"
        )

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

        saved_event = response.data[0]

        ws_payload = {
            "datetime": saved_event.get("datetime"),
            "plate": saved_event.get("plate") or "-",
            "province": saved_event.get("province") or "-",
            "direction": saved_event.get("direction") or "-",
            "role": role or "Visitor",
            "image": saved_event.get("blob"),
            "blob": saved_event.get("blob"),
        }

        import json

        await manager.broadcast(json.dumps(ws_payload))

        return {
            "message": "เพิ่มข้อมูล Event เรียบร้อยแล้ว",
            "data": saved_event,
            "vehicle_info": vehicle_data or "ไม่พบข้อมูลรถในระบบ (บันทึกเป็น visitor)",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาด: {str(e)}")


# ===
#  12. ROUTES: DASHBOARD (ข้อมูลสรุป)
# ===


@app.get("/dashboard/summary")
def dashboard_summary(
    date: str | None = None,
    # _user: dict = Depends(get_current_user) # 👈 (ควรเพิ่มทีหลัง)
):
    """(Endpoint) ดึงข้อมูล Stats Cards (ทั้งหมด, เข้า, ออก, ไม่รู้จัก)"""
    try:
        # ... (โค้ด Logic การนับ Stats Cards เหมือนเดิม) ...
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


@app.get("/dashboard/recent")
def dashboard_recent(
    limit: int = 50,
    # _user: dict = Depends(get_current_user) # 👈 (ควรเพิ่มทีหลัง)
):
    """(Endpoint) ดึง Event ล่าสุด 50 รายการ (พร้อม Role)"""
    try:
        # ... (โค้ด Logic การ Join และ Map ข้อมูลเหมือนเดิม) ...
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
            role = (vehicle.get("member") or {}).get("role")
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


@app.get("/dashboard/daily")
def dashboard_daily(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    # _user: dict = Depends(get_current_user) # 👈 (ควรเพิ่มทีหลัง)
):
    """(Endpoint) ดึงสถิติรายชั่วโมง (เข้า/ออก) สำหรับกราฟรายวัน"""
    try:
        # ... (โค้ด Logic การแปลง Timezone และนับข้อมูลรายชั่วโมง เหมือนเดิม) ...
        start_local = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=BKK)
        end_local = start_local + timedelta(days=1)
        start_utc = start_local.astimezone(timezone.utc).isoformat()
        end_utc = end_local.astimezone(timezone.utc).isoformat()

        response = (
            supabase.table("Event")
            .select("datetime, direction")
            .gte("datetime", start_utc)
            .lt("datetime", end_utc)
            .execute()
        )
        events = response.data or []

        hourly_data = {
            h: {"label": f"{h:02d}:00", "inside": 0, "outside": 0} for h in range(24)
        }

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


# ===
#  13. ROUTES: UPLOAD & EXPORT
# ===


@app.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    # _user: dict = Depends(get_current_user) # 👈 (ควรเพิ่มทีหลัง - หรือใช้ API Key)
):
    """(Endpoint) (สำหรับ Worker) อัปโหลดไฟล์ภาพ (blob) ไปยัง Storage"""
    try:
        contents = await file.read()
        url = upload_image_to_storage(contents, folder="plates")
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/export/events")
def export_events(
    start: str | None = Query(None),
    end: str | None = Query(None),
    direction: str | None = Query(None),
    plate: str | None = Query(None),
    # _user: dict = Depends(get_current_user) # 👈 (ควรเพิ่มทีหลัง)
):
    """(Endpoint) (สำหรับหน้า Search) Export ข้อมูล CSV ตาม Filter ที่เลือก"""
    try:
        # ... (โค้ด Logic การ Filter และสร้าง CSV เหมือนเดิม) ...
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

        output = io.StringIO(newline="")
        output.write("\ufeff")
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
