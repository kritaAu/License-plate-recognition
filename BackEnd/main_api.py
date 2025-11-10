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
from pydantic import BaseModel
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime, timedelta
import os
import io
import csv
from utils import upload_image_to_storage


# 2. ENVIRONMENT & DATABASE SETUP
# โหลดตัวแปรจากไฟล์ .env
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# สร้าง Supabase client แบบ Global
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# 3. FASTAPI INITIALIZATION
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


# 4. PYDANTIC MODELS
# Model สำหรับรับข้อมูล Event ใหม่จาก watch_folder.py
class EventIn(BaseModel):
    datetime: datetime
    plate: str | None = None
    province: str | None = None
    cam_id: int | None = None
    blob: str | None = None
    vehicle_id: int | None = None
    direction: str | None = None


# Model สำหรับข้อมูล Member ส่วนหนึ่งของ RegisterRequest
class MemberCreate(BaseModel):
    firstname: str
    lastname: str
    std_id: int
    faculty: str
    major: str
    role: str


# Model สำหรับข้อมูล Vehicle ส่วนหนึ่งของ RegisterRequest
class VehicleCreate(BaseModel):
    plate: str
    province: str


# Model สำหรับ Endpoint /register รวม Member และ Vehicle
class RegisterRequest(BaseModel):
    member: MemberCreate
    vehicle: VehicleCreate


# Model สำหรับอัปเดตข้อมูล Member PUT /members/{id}
class MemberUpdate(BaseModel):
    firstname: str | None = None
    lastname: str | None = None
    std_id: int | None = None
    faculty: str | None = None
    major: str | None = None
    role: str | None = None


# 5. WEBSOCKET MANAGER
# คลาสสำหรับจัดการการเชื่อมต่อ WebSocket ทั้งหมดเพื่อส่งอัปเดตแบบ Real-Time ไปยัง Frontend
class ConnectionManager:
    def __init__(self):
        # ลิสต์สำหรับเก็บ client ที่เชื่อมต่ออยู่
        self.active_connections: list[WebSocket] = []

    # รับการเชื่อมต่อใหม่จาก Client
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket connected: {len(self.active_connections)} active client(s)")

    # ลบ Client ที่ตัดการเชื่อมต่อออก
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(
                f"WebSocket disconnected: {len(self.active_connections)} active client(s)"
            )

    # ส่งข้อความ (แจ้งเตือน) ไปยังทุก Client ที่เชื่อมต่ออยู่
    async def broadcast(self, message: str):
        print(f"📡 Broadcast to {len(self.active_connections)} clients: {message}")
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Broadcast error: {e}")


# สร้าง Instance ของ Manager เพื่อใช้งานจริง
manager = ConnectionManager()


#  6. ROUTES: MEMBERS (จัดการข้อมูลสมาชิก)
# ดึงข้อมูลสมาชิกทั้งหมด สำหรับหน้า Member
@app.get("/members")
def get_members():
    try:
        # ใช้ Supabase Join (Vehicle(...))
        response = (
            supabase.table("Member")
            .select(
                "member_id, firstname, lastname, std_id, faculty, major, role, Vehicle(plate, province)"
            )
            .execute()
        )

        # จัดการข้อมูล Vehicle ที่อาจมาเป็น List
        members = []
        for row in response.data or []:
            vehicle = row.get("Vehicle") or {}
            if isinstance(vehicle, list) and vehicle:
                vehicle = vehicle[0]  # เอาคันแรก
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
# ลงทะเบียนสมาชิกใหม่ พร้อมกับรถ 1 คัน
@app.post("/register")  # รองรับ Path เก่า
def register_member_with_vehicle(payload: RegisterRequest):
    try:
        # 1. เพิ่มข้อมูล Member
        m_in = payload.member.model_dump()

        sid = m_in.get("std_id")
        if isinstance(sid, str) and sid.isdigit():
            m_in["std_id"] = int(sid)

        m_res = supabase.table("Member").insert(m_in).execute()
        if not m_res.data:
            raise HTTPException(status_code=400, detail="เพิ่มข้อมูลสมาชิกไม่สำเร็จ")

        member = m_res.data[0]
        member_id = member["member_id"]

        # 2. เพิ่มข้อมูล Vehicle โดยอ้างอิง member_id
        v_in = payload.vehicle.model_dump()
        v_in["member_id"] = member_id

        v_res = supabase.table("Vehicle").insert(v_in).execute()

        # 3. เพิ่ม Vehicle ไม่สำเร็จ ให้ลบ Member ที่เพิ่งสร้างทิ้ง (Rollback)
        if not v_res.data:
            supabase.table("Member").delete().eq("member_id", member_id).execute()
            raise HTTPException(
                status_code=400, detail="เพิ่มข้อมูลรถไม่สำเร็จ (Member ถูก Rollback)"
            )

        vehicle = v_res.data[0]

        # 4. คืนค่าข้อมูลสรุป (Frontend)
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


# อัปเดตข้อมูลสมาชิก (เฉพาะ field ที่ส่งมา)
@app.put("/members/{member_id}")
def update_member(member_id: int, data: MemberUpdate):
    try:
        # 1. ตรวจสอบว่ามี Member ID นี้จริงหรือไม่
        old_resp = (
            supabase.table("Member").select("*").eq("member_id", member_id).execute()
        )
        if not old_resp.data:
            raise HTTPException(status_code=404, detail="ไม่พบสมาชิกในระบบ")

        # 2. กรองเฉพาะ field ที่ส่งมา (ไม่เอาค่า None)
        update_fields = data.model_dump(exclude_none=True)
        if not update_fields:
            raise HTTPException(status_code=400, detail="ไม่พบข้อมูลที่ต้องการอัปเดต")

        # 3. สั่งอัปเดต
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


# ลบสมาชิกและรถที่ผูกอยู่
@app.delete("/members/{member_id}")
def delete_member(member_id: int):
    try:
        # 1. ตรวจสอบว่ามี Member ID นี้จริงหรือไม่
        old_resp = (
            supabase.table("Member").select("*").eq("member_id", member_id).execute()
        )
        if not old_resp.data:
            raise HTTPException(status_code=404, detail="ไม่พบสมาชิกในระบบ")

        # 2. (สำคัญ) ลบ Vehicle ที่ผูกอยู่ก่อน (เพราะมี Foreign Key)
        supabase.table("Vehicle").delete().eq("member_id", member_id).execute()

        # 3. ลบ Member
        supabase.table("Member").delete().eq("member_id", member_id).execute()

        return {
            "message": "ลบสมาชิกและรถที่ผูกอยู่เรียบร้อยแล้ว",
            "deleted_data": old_resp.data[0],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


#  7. ROUTES: EVENTS
@app.get("/events")
def get_events(
    # รับค่า Filters จาก Frontend (หน้า Search)
    limit: int = Query(1000, ge=1),
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
    direction: str | None = Query(None),
    query: str | None = Query(None, description="Plate query"),
):
    # (สำหรับหน้า Search และ Home) ดึงข้อมูล Event ทั้งหมด รองรับการกรอง (Filter) ตามวันที่, ทิศทาง, และป้ายทะเบียน
    try:
        # 1. สร้าง Query Builder และ Join Role มาเลย (แก้ N+1 Query)
        query_builder = (
            supabase.table("Event")
            .select(
                "datetime, plate, province, direction, blob,"
                "Vehicle!Event_vehicle_id_fkey(member:Member!Vehicle_member_id_fkey(role))"
            )
            .order("datetime", desc=True)
            .limit(limit)
        )

        # 2. กรองข้อมูล (Filtering)
        if start_date:
            query_builder = query_builder.gte("datetime", f"{start_date}T00:00:00")
        if end_date:
            query_builder = query_builder.lte("datetime", f"{end_date}T23:59:59")
        if direction and direction.lower() != "all":
            query_builder = query_builder.eq("direction", direction.upper())
        if query:
            # ค้นหาป้ายทะเบียนแบบ "contains" (มีคำนั้นอยู่)
            query_builder = query_builder.ilike("plate", f"%{query.strip()}%")

        # 3. ดึงข้อมูล
        response = query_builder.execute()

        # 4. Map ข้อมูล (แปลง) ให้เป็น Format ที่ Frontend (RecordsTable) ต้องการ | เพื่อลดภาระการประมวลผลที่ Frontend
        results = []
        for e in response.data or []:
            vehicle = e.get("Vehicle") or {}
            if isinstance(vehicle, list):
                vehicle = vehicle[0] if vehicle else {}

            role = vehicle.get("member", {}).get("role") or "Visitor"

            check_status = "บุคคลภายนอก"
            if role and role.lower() != "visitor":  # ถ้า Role ไม่ใช่ Visitor
                check_status = "บุคคลภายใน"

            results.append(
                {
                    "time": e.get("datetime"),
                    "plate": e.get("plate") or "-",
                    "province": e.get("province"),
                    "status": e.get("direction") or "-",  # Map -> status
                    "check": check_status,  # Map -> check
                    "imgUrl": e.get("blob") or None,  # Map -> imgUrl
                }
            )

        return results  # คืนค่าเป็น Array ที่ Map แล้ว
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching events: {str(e)}")


# (Endpoint หลักสำหรับ Worker) สร้าง Event ใหม่, บันทึกลง DB, และ Broadcast ไปยัง WebSocket
@app.post("/events")
async def create_event(event: EventIn):
    try:
        vehicle_data = None

        # 1. ตรวจสอบ Vehicle ในระบบ
        if event.plate and event.province:
            vehicle_check = (
                supabase.table("Vehicle")
                .select("vehicle_id, plate, province, member_id")
                .eq("plate", event.plate)
                .eq("province", event.province)
                .execute()
            )
            if vehicle_check.data:
                vehicle_data = vehicle_check.data[0]

        # 2. ตรวจสอบ direction (ใช้ cam_id เป็น Fallback ถ้า Worker ไม่ได้ส่งมา)
        direction = event.direction or (
            "IN" if event.cam_id == 1 else "OUT" if event.cam_id == 2 else "UNKNOWN"
        )

        # 3. เตรียมข้อมูล (Payload)
        payload = {
            "datetime": event.datetime.isoformat(),
            "plate": event.plate or None,
            "province": event.province or None,
            "direction": direction,
            "blob": event.blob,
            "cam_id": event.cam_id,
            "vehicle_id": vehicle_data["vehicle_id"] if vehicle_data else None,
        }

        # 4. บันทึกลง Supabase
        response = supabase.table("Event").insert(payload).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="เพิ่มข้อมูล Event ไม่สำเร็จ")

        # 5. (สำคัญ) Broadcast event ใหม่ไปยัง Client (Frontend)
        message = f"Event ใหม่: {event.plate or 'ไม่ทราบทะเบียน'} ({direction})"
        await manager.broadcast(message)

        return {
            "message": "เพิ่มข้อมูล Event เรียบร้อยแล้ว",
            "data": response.data[0],
            "vehicle_info": vehicle_data or "ไม่พบข้อมูลรถในระบบ (บันทึกเป็น visitor)",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาด: {str(e)}")


# (Endpoint หลักสำหรับ Frontend) รับการเชื่อมต่อ WebSocket จาก Client (React) และค้างไว้เพื่อรอรับการ Broadcast
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


#  8. ROUTES: CHECK PLATE
@app.get("/check_plate")
def check_plate(
    plate: str | None = Query(None, description="ทะเบียนรถ"),
    province: str | None = Query(None, description="จังหวัด"),
):
    # (Endpoint สำหรับ Worker) ตรวจสอบว่าป้ายทะเบียนนี้มีในระบบ (ตาราง Vehicle) หรือไม่
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


#  9. ROUTES: DASHBOARD
# (สำหรับ Frontend หน้า Home) ดึงข้อมูล Stats Cards (ทั้งหมด, เข้า, ออก, ไม่รู้จัก) ของวันที่เลือก
@app.get("/dashboard/summary")
def dashboard_summary(date: str | None = None):
    try:
        # ถ้าไม่ส่งวันที่มา ให้ใช้วันที่ปัจจุบัน
        date = date or datetime.now().strftime("%Y-%m-%d")
        start, end = f"{date}T00:00:00", f"{date}T23:59:59"

        # 1. ดึงข้อมูล Event เฉพาะวันนั้น
        response = (
            supabase.table("Event")
            .select("event_id, plate, province, direction, vehicle_id")
            .gte("datetime", start)
            .lte("datetime", end)
            .execute()
        )
        events = response.data

        # 2. นับและสรุปผล (Aggregation ใน Python)
        ins = [e for e in events if e["direction"] == "IN"]
        outs = [e for e in events if e["direction"] == "OUT"]
        unknown = [
            e for e in events if not e.get("plate") or e.get("vehicle_id") is None
        ]

        return {
            "date": date,
            "total_events": len(events),
            "in": len(ins),
            "out": outs,
            "unknown_or_visitor": len(unknown),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# (สำหรับ Frontend หน้า Home - ถ้าใช้ Logic เดิม) ดึง Event ล่าสุด 10 รายการ (พร้อม Role)
@app.get("/dashboard/recent")
def dashboard_recent(limit: int = 10):
    try:
        # 🚀 (N+1 Query Fix) Join เพื่อดึง Role มาใน Query เดียว
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

            role = vehicle.get("member", {}).get("role") or "Visitor"
            image_url = e.get("blob") or None

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

        # คืนค่าใน Format ที่ Frontend (Home.jsx เก่า) คาดหวัง
        return {"count": len(results), "data": results}
    except Exception as ex:
        raise HTTPException(
            status_code=500, detail=f"Error in dashboard_recent: {str(ex)}"
        )


# (สำหรับ Frontend หน้า Home - กราฟรายวัน) ดึงสถิติรายชั่วโมง (เข้า/ออก) สำหรับวันที่ระบุ
@app.get("/dashboard/daily")
def dashboard_daily(date: str = Query(..., description="Date in YYYY-MM-DD format")):
    try:
        # 1. Parse date and define time range
        start_date = datetime.strptime(date, "%Y-%m-%d")
        end_date = start_date + timedelta(days=1)

        # 2. Fetch all events for the day from Supabase
        response = (
            supabase.table("Event")
            .select("datetime, direction")
            .gte("datetime", start_date.isoformat())
            .lt("datetime", end_date.isoformat())
            .execute()
        )

        events = response.data

        # 3. Initialize hourly series for 24 hours
        hourly_data = {}
        for h in range(24):
            hour_str = f"{h:02d}:00"
            hourly_data[h] = {"label": hour_str, "inside": 0, "outside": 0}

        # 4. Aggregate events in Python
        for event in events:
            event_dt = datetime.fromisoformat(event["datetime"])
            hour = event_dt.hour
            direction = event.get("direction", "").lower()

            if 0 <= hour < 24:
                # 'inside' (บุคคลภายใน) ถูก Map จาก Logic ของ DailyLineChart.jsx
                # 'outside' (บุคคลภายนอก)
                # Logic นี้ของ Home.jsx เก่านับเฉพาะ "IN"
                # แต่ Logic ใหม่ใน /dashboard/daily นับทั้ง "IN" และ "OUT"
                if direction == "in":
                    hourly_data[hour]["inside"] += 1  #
                elif direction == "out":
                    hourly_data[hour]["outside"] += 1

        # 5. Convert dictionary to list for the frontend
        result_series = [hourly_data[h] for h in range(24)]

        return result_series  # คืนค่าเป็น Array [ {label: "00:00", ...}, ... ]

    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid date format. Use YYYY-MM-DD."
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500, detail=f"Error in dashboard_daily: {str(ex)}"
        )


#  10. ROUTES: UPLOAD IMAGE
# (Endpoint สำหรับ Worker) อัปโหลดไฟล์ภาพ (blob) ไปยัง Storage
@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    try:
        # (async def เพราะต้อง await file.read())
        contents = await file.read()
        # (ควรเพิ่มการตรวจสอบขนาดไฟล์/ประเภทไฟล์ ที่นี่)
        url = upload_image_to_storage(contents, folder="plates")
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


#  11. ROUTES: EXPORT CSV
@app.get("/export/events")
def export_events(
    # 1. รับ Parameters จาก Frontend (หน้า Search)
    start: str | None = Query(None),
    end: str | None = Query(None),
    direction: str | None = Query(None),
    plate: str | None = Query(None),  # (Frontend ส่ง "query" มาเป็น "plate")
):
    # (สำหรับ Frontend หน้า Search) Export ข้อมูล CSV ตาม Filter ที่เลือก
    try:
        # 2. สร้าง Query Builder โดยใช้ Filter
        query_builder = supabase.table("Event").select("*").order("datetime", desc=True)

        if start:
            query_builder = query_builder.gte("datetime", f"{start}T00:00:00")
        if end:
            query_builder = query_builder.lte("datetime", f"{end}T23:59:59")
        if direction and direction.lower() != "all":
            query_builder = query_builder.eq("direction", direction.upper())
        if plate:
            query_builder = query_builder.ilike("plate", f"%{plate.strip()}%")

        # 3. ดึงข้อมูล
        response = query_builder.execute()
        data = response.data or []

        # 4. สร้างไฟล์ CSV ใน Memory
        output = io.StringIO(newline="")
        output.write("\ufeff")  # (สำคัญ) UTF-8 BOM สำหรับ Excel อ่านไทย

        fieldnames = (
            list(data[0].keys())
            if data
            else ["datetime", "plate", "province", "direction"]
        )
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        if data:
            writer.writerows(data)
        output.seek(0)  # กลับไปที่จุดเริ่มต้นของไฟล์

        # 5. ส่งไฟล์ CSV กลับไป
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=events_filtered.csv"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting events: {str(e)}")


#  12. HEALTH CHECK
# Endpoint ตรวจสอบว่า API ทำงานอยู่
@app.get("/")
def root():
    return {"status": "ok", "message": "API is running"}
