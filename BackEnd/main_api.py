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
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from typing import Optional, Union, Literal
from passlib.context import CryptContext
from matching_logic import find_best_match
import os
import io
import csv
import json
import jwt
import asyncio
from datetime import datetime, timedelta, timezone

from supabase import create_client
from dotenv import load_dotenv
from utils import upload_image_to_storage

# ===
#  2. LOGGING & TIMEZONE
# ===
import logging
import sys

# ตั้งค่า logging ให้แสดงเฉพาะ WARNING ขึ้นไป
logging.basicConfig(
    level=logging.WARNING,  # แสดงเฉพาะ WARNING ขึ้นไป
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

# Logger สำหรับ app (ยังคงเห็น INFO)
logger = logging.getLogger("app")
logger.setLevel(logging.INFO)

# ปิด logging ของ libraries
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("supabase").setLevel(logging.WARNING)


try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None


# timezone Asia/Bangkok (UTC+7)
def get_bkk_tz():
    if ZoneInfo:
        try:
            return ZoneInfo("Asia/Bangkok")
        except Exception:
            pass
    return timezone(timedelta(hours=7))


BKK = get_bkk_tz()

# ===
#  3. ENVIRONMENT & DATABASE
# ===
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ===
#  4. FASTAPI INITIALIZATION
# ===
app = FastAPI(title="License Plate Recognition API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===
#  5. AUTHENTICATION
# ===
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 ชั่วโมง

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


# ตรวจสอบ password
def verify_password(plain_password: str, hashed_password: str) -> bool:
    if len(plain_password.encode("utf-8")) > 72:
        plain_password = plain_password.encode("utf-8")[:72].decode(
            "utf-8", errors="ignore"
        )
    return pwd_context.verify(plain_password, hashed_password)


# สร้าง JWT token
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# เช็ค username และ password ใน Supabase
def authenticate_user(username: str, password: str):
    response = (
        supabase.table("Users")
        .select("username, hashed_password, role")
        .eq("username", username)
        .limit(1)
        .execute()
    )

    if not response.data:
        return False

    user = response.data[0]

    # ตรวจสอบว่าเป็น admin เท่านั้น
    if user.get("role") != "admin":
        logger.warning(f"Non-admin user tried to login: {username}")
        return False

    if not verify_password(password, user["hashed_password"]):
        return False

    return user


# Dependency ดึงข้อมูล user ปัจจุบันจาก Token
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
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

    response = (
        supabase.table("Users")
        .select("username, role")
        .eq("username", username)
        .eq("role", "admin")  # ต้องเป็น admin เท่านั้น
        .limit(1)
        .execute()
    )

    if not response.data:
        raise credentials_exception

    return response.data[0]


# ===
#  6. PYDANTIC MODELS
# ===
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# Model สำหรับรับข้อมูล Event จาก batch_process
class EventIn(BaseModel):
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
        if v.tzinfo is None:
            return v.replace(tzinfo=BKK)
        return v


# Model สำหรับสร้างสมาชิกใหม่
class MemberCreate(BaseModel):
    firstname: str
    lastname: str
    std_id: Optional[Union[int, str]] = None
    faculty: Optional[str] = None
    major: Optional[str] = None
    role: Literal["นักศึกษา", "อาจารย์", "เจ้าหน้าที่", "อื่น ๆ", "อื่นๆ"] = "นักศึกษา"


# Model สำหรับสร้างรถใหม่
class VehicleCreate(BaseModel):
    plate: str
    province: str


# Model สำหรับลงทะเบียนสมาชิก + รถ
class RegisterRequest(BaseModel):
    member: MemberCreate
    vehicle: VehicleCreate


# Model สำหรับอัปเดตสมาชิก
class MemberUpdate(BaseModel):
    firstname: str | None = None
    lastname: str | None = None
    std_id: int | None = None
    faculty: str | None = None
    major: str | None = None
    role: str | None = None


# ===
#  7. WEBSOCKET MANAGER
# ===
# จัดการ WebSocket
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected: {len(self.active_connections)} active")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(
                f"WebSocket disconnected: {len(self.active_connections)} active"
            )

    async def broadcast(self, message: str):
        logger.info(f"Broadcasting to {len(self.active_connections)} clients")
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Broadcast error: {e}")


manager = ConnectionManager()


# ===
#  8. HELPER FUNCTIONS
# ===
def _canon_plate(s: str | None) -> str | None:
    if not s:
        return None
    return "".join(s.split()) or None


def _canon_text(s: str | None) -> str | None:
    if not s:
        return None
    return s.strip().lower() or None


# ค้นหา Role จากป้ายทะเบียน (Fallback)
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


from background_matcher import process_unmatched_sessions


# ===
#  9. ROUTES: AUTHENTICATION
# ===
# Endpoint สำหรับ Login
@app.post("/api/auth/login", response_model=LoginResponse)
def login(request: LoginRequest):
    safe_password = request.password[:72]
    user = authenticate_user(request.username, safe_password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือไม่มีสิทธิ์เข้าถึง",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user["username"]})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"username": user["username"], "role": user["role"]},
    }


# ดึงข้อมูล user
@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {"username": current_user["username"], "role": current_user["role"]}


# ===
#  10. ROUTES: WEBSOCKET
# ===
# รับการเชื่อมต่อ WebSocket จาก Frontend
@app.websocket("/ws/events")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            logger.debug(f"[WS] Received from client: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ===
#  11. ROUTES: MEMBERS
# ===
# ดึงข้อมูลสมาชิกทั้งหมด พร้อม Filter
@app.get("/members")
def get_members(
    plate: str | None = Query(None),
    firstname: str | None = Query(None),
    lastname: str | None = Query(None),
):
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


# ลงทะเบียนสมาชิกใหม่ พร้อมกับรถ 1 คัน
@app.post("/members/register")
@app.post("/register")
def register_member_with_vehicle(payload: RegisterRequest):
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


# อัปเดตข้อมูลสมาชิก
@app.patch("/members/{member_id}")
def update_member(member_id: int, payload: MemberUpdate):
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


# ลบสมาชิกและรถที่ผูกอยู่
@app.delete("/members/{member_id}")
def delete_member(member_id: int):
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


# ===
#  12. ROUTES: EVENTS
# ===
# ดึงข้อมูล Event ทั้งหมด - ใช้ JOIN เดียว
@app.get("/events")
def get_events(
    limit: int = Query(1000, ge=1),
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
    direction: str | None = Query(None),
    query: str | None = Query(None, description="Plate query"),
):
    try:
        # Query พร้อม JOIN Member ในครั้งเดียว
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

            # สร้างชื่อเต็ม
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
                    # ส่งข้อมูล member มาให้ครบ
                    "member_name": member_name,
                    "member_role": role,
                    "member_firstname": member.get("firstname"),
                    "member_lastname": member.get("lastname"),
                    "member_std_id": member.get("std_id"),
                }
            )

        # Log แค่สรุปผลเดียว
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
        logger.error(f"❌ Events error: {str(ex)}")
        raise HTTPException(status_code=500, detail=f"Error fetching events: {str(ex)}")


# ===
#  12.5. ROUTES: PARKING SESSIONS (ใหม่)
# ===


# บันทึกรถเข้า
@app.post("/api/entry")
async def record_entry(event: EventIn):
    """บันทึกรถเข้า - สร้าง Parking Session ใหม่"""
    try:
        # 1. บันทึกใน Event table (เก็บ transaction log)
        event_data = {
            "datetime": event.datetime.isoformat(),
            "plate": event.plate,
            "province": event.province,
            "direction": "IN",
            "blob": event.blob,
            "cam_id": event.cam_id or 1,
        }
        event_resp = supabase.table("Event").insert(event_data).execute()

        if not event_resp.data:
            raise HTTPException(status_code=400, detail="บันทึก Event ไม่สำเร็จ")

        event_id = event_resp.data[0]["event_id"]

        # 2. หา vehicle_id และ member_id จากฐานข้อมูล
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

        # 3. สร้าง Parking Session
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

        # 4. Broadcast ผ่าน WebSocket
        await manager.broadcast(
            json.dumps(
                {
                    "type": "entry",
                    "plate": event.plate or "-",
                    "province": event.province or "-",
                    "time": event.datetime.isoformat(),
                    "status": "parked",
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


@app.post("/members/batch")
def get_members_batch(plates: list[str]):
    """ดึงข้อมูลสมาชิกจากหลาย plates พร้อมกัน"""
    try:
        if not plates or len(plates) > 100:  # จำกัดไม่เกิน 100 plates ต่อครั้ง
            raise HTTPException(status_code=400, detail="Please provide 1-100 plates")

        # สร้าง OR condition สำหรับ Supabase
        # ใช้ in operator แทนการ ilike หลายๆ ครั้ง
        response = (
            supabase.table("Member")
            .select(
                "member_id, firstname, lastname, std_id, faculty, major, role, "
                "Vehicle(plate, province)"
            )
            .execute()
        )

        # Filter ใน Python แทน (เพราะ Supabase ไม่รองรับ OR + ILIKE ที่ซับซ้อน)
        all_members = response.data or []

        # สร้าง dict สำหรับค้นหาเร็ว
        plate_map = {}
        for plate in plates:
            plate_clean = plate.strip().lower()
            plate_map[plate_clean] = None

        results = {}
        for row in all_members:
            vehicle = row.get("Vehicle")
            if isinstance(vehicle, list) and vehicle:
                vehicle = vehicle[0]
            elif isinstance(vehicle, list):
                continue

            vehicle_plate = vehicle.get("plate", "").strip().lower()

            # เช็คว่า plate ตรงกับที่ขอหรือไม่
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


# ===
#  12.5. ROUTES: PARKING SESSIONS (ใหม่)
# ===


# บันทึกรถเข้า
@app.post("/api/entry")
async def record_entry(event: EventIn):
    """บันทึกรถเข้า - สร้าง Parking Session ใหม่"""
    try:
        # 1. บันทึกใน Event table (เก็บ transaction log)
        event_data = {
            "datetime": event.datetime.isoformat(),
            "plate": event.plate,
            "province": event.province,
            "direction": "IN",
            "blob": event.blob,
            "cam_id": event.cam_id or 1,
        }
        event_resp = supabase.table("Event").insert(event_data).execute()

        if not event_resp.data:
            raise HTTPException(status_code=400, detail="บันทึก Event ไม่สำเร็จ")

        event_id = event_resp.data[0]["event_id"]

        # 2. หา vehicle_id และ member_id จากฐานข้อมูล
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

        # 3. สร้าง Parking Session
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

        # 4. Broadcast ผ่าน WebSocket
        await manager.broadcast(
            json.dumps(
                {
                    "type": "entry",
                    "plate": event.plate or "-",
                    "province": event.province or "-",
                    "time": event.datetime.isoformat(),
                    "status": "parked",
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


# บันทึกรถออก (พร้อม Matching)
@app.post("/api/exit")
async def record_exit(event: EventIn):
    """บันทึกรถออก - อัปเดต Session ที่มีอยู่ หรือสร้างใหม่ถ้าไม่เจอ"""
    try:
        # 1. บันทึกใน Event table
        event_data = {
            "datetime": event.datetime.isoformat(),
            "plate": event.plate,
            "province": event.province,
            "direction": "OUT",
            "blob": event.blob,
            "cam_id": event.cam_id or 2,
        }
        event_resp = supabase.table("Event").insert(event_data).execute()

        if not event_resp.data:
            raise HTTPException(status_code=400, detail="บันทึก Event ไม่สำเร็จ")

        exit_event_id = event_resp.data[0]["event_id"]

        # 2. หาคู่ที่ตรงที่สุดด้วย Matching Algorithm
        match_result = None
        if event.plate:
            match_result = find_best_match(event.plate, event.province or "", supabase)

        # 3. ถ้าไม่เจอคู่ -> สร้าง session แบบ "exit only"
        if not match_result:
            logger.warning(f"⚠️ No match found for exit: {event.plate}")

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

        # 4. เจอคู่แล้ว -> อัปเดต session
        session = match_result["session"]
        entry_time = datetime.fromisoformat(session["entry_time"])
        exit_time = event.datetime

        # คำนวณระยะเวลาจอด (นาที)
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

        # 5. Broadcast
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
            f"Exit matched ({match_result['match_type']}): {event.plate}, duration: {duration} min"
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


# ดึงข้อมูล Parking Sessions
@app.get("/api/parking-sessions")
def get_parking_sessions(
    status: str = Query("all", description="all, parked, completed, unmatched"),
    limit: int = Query(100, ge=1, le=1000),
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
):
    """ดึงข้อมูล Parking Sessions พร้อม Filter"""
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

        # Filter ตาม status
        if status and status.lower() != "all":
            qb = qb.eq("status", status.lower())

        # Filter ตามวันที่
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

            # สร้างชื่อเต็ม
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


# แก้ไขป้ายทะเบียนที่อ่านผิด
@app.patch("/api/parking-sessions/{session_id}/fix-plate")
def fix_session_plate(
    session_id: str,
    correct_plate: str = Query(..., description="ป้ายทะเบียนที่ถูกต้อง"),
    correct_province: str = Query(..., description="จังหวัดที่ถูกต้อง"),
):
    """แก้ไขป้ายทะเบียนของ Session ที่อ่านผิด"""
    try:
        # ตรวจสอบว่า session มีอยู่จริง
        check = (
            supabase.table("parkingsession")
            .select("session_id, status")
            .eq("session_id", session_id)
            .execute()
        )

        if not check.data:
            raise HTTPException(status_code=404, detail="ไม่พบ Session นี้")

        # อัปเดตทั้งป้ายเข้าและออก
        update_data = {
            "plate_number_entry": correct_plate.strip(),
            "province": correct_province.strip(),
        }

        # ถ้ามีป้ายออกด้วย ให้อัปเดตด้วย
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

        logger.info(f"✏️ Fixed plate for session {session_id}: {correct_plate}")

        return {"message": "แก้ไขป้ายทะเบียนสำเร็จ", "data": updated.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fixing plate: {str(e)}")
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาด: {str(e)}")


# ดึงรายละเอียด Session แบบเจาะลึก
@app.get("/api/parking-sessions/{session_id}")
def get_session_detail(session_id: str):
    """ดึงรายละเอียดของ Session พร้อมภาพเข้า-ออก"""
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

        # จัดรูปแบบข้อมูล
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


# สร้าง Event ใหม่, บันทึกลง DB, และ Broadcast
@app.post("/events")
async def create_event(event: EventIn):
    try:
        plate_raw = (event.plate or "").strip()
        prov_raw = (event.province or "").strip()

        direction = event.direction or (
            "IN" if event.cam_id == 1 else "OUT" if event.cam_id == 2 else "UNKNOWN"
        )

        # 🆕 เพิ่มส่วนนี้ - หา vehicle_data ก่อน
        vehicle_data = None
        p_can = _canon_plate(plate_raw)
        prov_can = _canon_text(prov_raw)

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

        # บันทึก Event ก่อน
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
        event_id = saved_event["event_id"]

        # ตรวจสอบว่าควร match หรือไม่
        if direction == "IN":
            # สร้าง parkingsession ใหม่
            session_data = {
                "plate_number_entry": event.plate,
                "province": event.province,
                "entry_time": event.datetime.isoformat(),
                "status": "parked",
                "entry_event_id": event_id,
                "vehicle_id": vehicle_data["vehicle_id"] if vehicle_data else None,
                "member_id": vehicle_data["member_id"] if vehicle_data else None,
            }
            supabase.table("parkingsession").insert(
                session_data
            ).execute()  # ✅ lowercase
            logger.info(f"Created parking session for {event.plate}")

        elif direction == "OUT" and event.plate:
            # ลองหา match
            match_result = find_best_match(event.plate, event.province or "", supabase)

            if match_result:
                # มี match -> อัปเดต session
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
                    f"Matched exit: {event.plate} ({match_result['match_type']})"
                )
            else:
                # ไม่มี match -> สร้าง session ใหม่แบบ unmatched
                unmatched_data = {
                    "plate_number_exit": event.plate,
                    "province": event.province,
                    "exit_time": event.datetime.isoformat(),
                    "status": "unmatched",
                    "exit_event_id": event_id,
                }
                supabase.table("parkingsession").insert(
                    unmatched_data
                ).execute()  # ✅ lowercase
                logger.warning(f"No match for exit: {event.plate}")

        # Broadcast WebSocket (ตามเดิม)
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
        logger.error(f"❌ Error in create_event: {str(e)}")
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาด: {str(e)}")


# แก้ไขป้ายทะเบียนหรือจังหวัดของ Event
@app.patch("/events/{event_id}")
def update_event(
    event_id: int,
    plate: str | None = None,
    province: str | None = None,
):
    try:
        if plate is None and province is None:
            raise HTTPException(
                status_code=400,
                detail="ต้องระบุอย่างน้อย 1 ฟิลด์ที่ต้องการแก้ไข (plate หรือ province)",
            )

        update_data = {}
        if plate is not None:
            update_data["plate"] = plate.strip()
        if province is not None:
            update_data["province"] = province.strip()

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
                "event_id": updated_event.get("event_id"),  # เปลี่ยนจาก id
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


# ===
#  13. ROUTES: DASHBOARD
# ===
# ดึงข้อมูล Stats Cards ทั้งหมด, เข้า, ออก, ไม่รู้จัก
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


# ดึง Event ล่าสุด 50 รายการ พร้อม Role
@app.get("/dashboard/recent")
def dashboard_recent(limit: int = 50):
    try:
        response = (
            supabase.table("Event")
            .select(
                "datetime, plate, province, direction, blob, "
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


# ดึงสถิติรายชั่วโมง (เข้า/ออก) สำหรับกราฟรายวัน
@app.get("/dashboard/daily")
def dashboard_daily(date: str = Query(..., description="Date in YYYY-MM-DD format")):
    try:
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
#  14. ROUTES: UPLOAD & EXPORT
# ===
# อัปโหลดไฟล์ภาพ blob ไปยัง Storage
@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        url = upload_image_to_storage(contents, folder="plates")
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Export ข้อมูล CSV ตาม Filter ที่เลือก
@app.get("/export/events")
def export_events(
    start: str | None = Query(None),
    end: str | None = Query(None),
    direction: str | None = Query(None),
    plate: str | None = Query(None),
):
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


# ===
#  15. STARTUP EVENTS
# ===


@app.on_event("startup")
async def startup_event():
    """เริ่ม background task ตอน server start"""
    try:
        asyncio.create_task(process_unmatched_sessions(supabase))
        logger.info("Background matcher started successfully")
    except Exception as e:
        logger.error(f"Failed to start background matcher: {e}")
