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
import os
import io
import csv
import json
import jwt
from datetime import datetime, timedelta, timezone

from supabase import create_client
from dotenv import load_dotenv
from utils import upload_image_to_storage

# ===
#  2. LOGGING & TIMEZONE
# ===
import logging

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

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
        # Query พร้อม JOIN
        qb = (
            supabase.table("Event")
            .select(
                "datetime, plate, province, direction, blob, vehicle_id, "
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
            # ดึง role จาก JOIN ที่ query มาแล้ว
            vehicle = e.get("Vehicle") or {}
            if isinstance(vehicle, list):
                vehicle = vehicle[0] if vehicle else {}
            member_obj = vehicle.get("member") or {}
            if isinstance(member_obj, list):
                member_obj = member_obj[0] if member_obj else {}

            role = member_obj.get("role")

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

        logger.info(f"Returned {len(results)} events")
        return results

    except Exception as ex:
        logger.error(f"Error fetching events: {str(ex)}")
        raise HTTPException(status_code=500, detail=f"Error fetching events: {str(ex)}")


# สร้าง Event ใหม่, บันทึกลง DB, และ Broadcast
@app.post("/events")
async def create_event(event: EventIn):
    try:
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
                    "vehicle_id, plate, province, member_id, "
                    "member:Member!Vehicle_member_id_fkey(role)"
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

        await manager.broadcast(json.dumps(ws_payload))

        return {
            "message": "เพิ่มข้อมูล Event เรียบร้อยแล้ว",
            "data": saved_event,
            "vehicle_info": vehicle_data or "ไม่พบข้อมูลรถในระบบ (บันทึกเป็น visitor)",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาด: {str(e)}")


# แก้ไขป้ายทะเบียนหรือจังหวัดของ Event
@app.patch("/events/{event_id}")
def update_event(
    event_id: int,
    plate: str | None = None,
    province: str | None = None,
):
    try:
        # ตรวจสอบว่ามีข้อมูลที่จะแก้ไขหรือไม่
        if plate is None and province is None:
            raise HTTPException(
                status_code=400,
                detail="ต้องระบุอย่างน้อย 1 ฟิลด์ที่ต้องการแก้ไข (plate หรือ province)",
            )

        # เตรียมข้อมูลที่จะ update
        update_data = {}
        if plate is not None:
            update_data["plate"] = plate.strip()
        if province is not None:
            update_data["province"] = province.strip()

        # ตรวจสอบว่า Event มีอยู่จริงหรือไม่
        check_resp = (
            supabase.table("Event")
            .select("id, datetime, plate, province")
            .eq("id", event_id)
            .execute()
        )

        if not check_resp.data:
            raise HTTPException(status_code=404, detail=f"ไม่พบ Event ID: {event_id}")

        # อัปเดตข้อมูล
        update_resp = (
            supabase.table("Event").update(update_data).eq("id", event_id).execute()
        )

        if not update_resp.data:
            raise HTTPException(status_code=500, detail="ไม่สามารถแก้ไขข้อมูลได้")

        updated_event = update_resp.data[0]

        logger.info(f"Updated Event ID {event_id}: {update_data}")

        return {
            "success": True,
            "message": "แก้ไขข้อมูลสำเร็จ",
            "data": {
                "id": updated_event.get("id"),
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
