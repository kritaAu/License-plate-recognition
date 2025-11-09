from fastapi import FastAPI,HTTPException,UploadFile,File,Query,WebSocket,WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime
import os
import io
import csv
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
    direction: str | None = None


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
#  WEBSOCKET MANAGER
# ====


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(
            f"WebSocket connected: {len(self.active_connections)} active client(s)"
        )

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(
                f"WebSocket disconnected: {len(self.active_connections)} active client(s)"
            )

    async def broadcast(self, message: str):
        """ส่งข้อความไปยังทุก client ที่เชื่อมต่ออยู่"""
        print(f"📡 Broadcast to {len(self.active_connections)} clients: {message}")
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"Broadcast error: {e}")


manager = ConnectionManager()

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
            # จัดการ Vehicle ที่อาจมาเป็น list
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
@app.post("/members/register")
@app.post("/register")
def register_member_with_vehicle(payload: RegisterRequest):
    try:
        m_in = payload.member.model_dump()

        sid = m_in.get("std_id")
        if isinstance(sid, str) and sid.isdigit():
            m_in["std_id"] = int(sid)

        m_res = supabase.table("Member").insert(m_in).execute()
        if not m_res.data:
            raise HTTPException(status_code=400, detail="เพิ่มข้อมูลสมาชิกไม่สำเร็จ")
        member = m_res.data[0]
        member_id = member["member_id"]

        v_in = payload.vehicle.model_dump()
        v_in["member_id"] = member_id

        v_res = supabase.table("Vehicle").insert(v_in).execute()
        if not v_res.data:

            supabase.table("Member").delete().eq("member_id", member_id).execute()
            raise HTTPException(status_code=400, detail="เพิ่มข้อมูลรถไม่สำเร็จ")
        vehicle = v_res.data[0]

        row = {
            "member_id": member_id,
            "std_id": member.get("std_id"),
            "firstname": member.get("firstname"),
            "lastname": member.get("lastname"),
            "plate": vehicle.get("plate"),
            "province": vehicle.get("province"),
        }

        return {
            "message": "เพิ่มข้อมูลสมาชิกและรถเรียบร้อยแล้ว",
            "row": row,             
            "member": member,
            "vehicle": vehicle,
        }

    except HTTPException:
        raise
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
        update_fields = data.model_dump(exclude_none=True)

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
        # อ่านข้อมูลสมาชิกเดิม
        old_resp = (
            supabase.table("Member").select("*").eq("member_id", member_id).execute()
        )
        if not old_resp.data:
            raise HTTPException(status_code=404, detail="ไม่พบสมาชิกในระบบ")

        old_data = old_resp.data[0]

        # 1) ลบรถที่ผูกกับสมาชิกก่อน
        supabase.table("Vehicle").delete().eq("member_id", member_id).execute()

        # 2) ลบสมาชิก
        supabase.table("Member").delete().eq("member_id", member_id).execute()

        return {
            "message": "ลบสมาชิกและรถที่ผูกอยู่เรียบร้อยแล้ว",
            "deleted_data": old_data,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ====
#  ROUTES: EVENTS
# ====


# ดึง Event ล่าสุด
@app.get("/events")
def get_events(
    # รับค่า Filters จาก Frontend
    limit: int = Query(1000, ge=1), 
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
    end_date: str | None = Query(None, description="YYYY-MM-DD"),
    direction: str | None = Query(None),
    query: str | None = Query(None, description="Plate query")
):
    try:
        # 1. ใช้ Query Builder ของ Supabase และ Join Role มาเลย
        query_builder = supabase.table("Event").select(
            "datetime, plate, province, direction, blob,"
            "Vehicle!Event_vehicle_id_fkey(member:Member!Vehicle_member_id_fkey(role))" 
        ).order("datetime", desc=True).limit(limit)

        # 2. กรองข้อมูล
        if start_date:
            query_builder = query_builder.gte("datetime", f"{start_date}T00:00:00")
        if end_date:
            query_builder = query_builder.lte("datetime", f"{end_date}T23:59:59")
        if direction and direction.lower() != 'all':
            query_builder = query_builder.eq("direction", direction.upper())
        if query:
            query_builder = query_builder.ilike("plate", f"%{query.strip()}%")

        # 3. ดึงข้อมูล
        response = query_builder.execute()
        
        # 4. Map ข้อมูลที่ได้จาก DB ให้เป็น Format ที่ Frontend 
        results = []
        for e in response.data or []:
            vehicle = e.get('Vehicle') or {}
            if isinstance(vehicle, list):
                vehicle = vehicle[0] if vehicle else {}
            
            role = vehicle.get("member", {}).get("role") or "Visitor"
            
            # Map Role ให้เป็น "บุคคลภายใน/ภายนอก"
            check_status = "บุคคลภายนอก"
            if role and role.lower() != "visitor": # ถ้า Role ไม่ใช่ Visitor
                check_status = "บุคคลภายใน" 

            results.append({
                "time": e.get('datetime'), # ส่ง datetime 
                "plate": e.get('plate') or "-",
                "province": e.get('province'),
                "status": e.get('direction') or "-", # Map "direction" เป็น "status"
                "check": check_status, # Map "role" เป็น "check"
                "imgUrl": e.get('blob') or None, #  Map "blob" เป็น "imgUrl"
            })

        return results #คืนค่าเป็น Array ที่ Map แล้ว

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching events: {str(e)}")


# -------------------------------------------------------------
# เพิ่ม Event ใหม่ (บันทึกได้แม้ไม่พบรถในระบบ)
# -------------------------------------------------------------
@app.post("/events")
async def create_event(event: EventIn):
    try:
        vehicle_data = None

        # 1. ตรวจสอบ Vehicle ในระบบ (ถ้ามี plate และ province)
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

        # 2. ตรวจสอบ direction (ใช้ค่า cam_id แทนถ้าไม่ได้ส่งมา)
        direction = event.direction or (
            "IN" if event.cam_id == 1 else "OUT" if event.cam_id == 2 else "UNKNOWN"
        )

        # 3. เตรียมข้อมูลสำหรับบันทึก Event
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

        # 5. Broadcast event ใหม่ให้ทุก client ที่เชื่อมต่ออยู่
        message = f"Event ใหม่: {event.plate or 'ไม่ทราบทะเบียน'} ({direction})"
        await manager.broadcast(message)

        return {
            "message": "เพิ่มข้อมูล Event เรียบร้อยแล้ว",
            "data": response.data[0],
            "vehicle_info": vehicle_data or "ไม่พบข้อมูลรถในระบบ (บันทึกเป็น visitor)",
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาด: {str(e)}")


@app.websocket("/ws/events")
async def websocket_endpoint(websocket: WebSocket):
    """เชื่อมต่อ WebSocket เพื่อรับ Event แบบเรียลไทม์"""
    await manager.connect(websocket)
    try:
        while True:
            # ถ้ามีข้อความจาก client (optional)
            data = await websocket.receive_text()
            print(f"[WS] Received from client: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)


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
        # ใช้ Embeded Query เพื่อดึง Role พร้อมกัน
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
            # Role จะอยู่ใน vehicle['member']['role']
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


# สรุปจำนวนรถเข้าออกต่อวัน (ไม่มีการเปลี่ยนแปลง)
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
            # นับรวม Visitor และรถที่อ่านป้ายไม่ได้
            e
            for e in events
            if not e.get("plate") or e.get("vehicle_id") is None
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
                "datetime, plate, province, direction, blob,"
                # Event -> Vehicle -> Member -> Role
                "Vehicle!Event_vehicle_id_fkey(member:Member!Vehicle_member_id_fkey(role))"
            )
            .order("datetime", desc=True)
            .limit(limit)
            .execute()
        )

        results = []
        for e in response.data or []:
            vehicle = e.get("Vehicle") or {}
            # จัดการกรณี Vehicle เป็น list/object
            if isinstance(vehicle, list):
                vehicle = vehicle[0] if vehicle else {}

            # ดึง Role: Event -> Vehicle -> Member -> Role
            role = vehicle.get("member", {}).get("role") or "Visitor"

            # blob ถูกเก็บเป็น URL string อยู่แล้ว
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

        return {"count": len(results), "data": results}

    except Exception as ex:
        # log ex ไว้ใน server console จะเห็น stacktrace ต้นตอ
        raise HTTPException(
            status_code=500, detail=f"Error in dashboard_recent: {str(ex)}"
        )


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

# ทำเป็นไฟล์ csv
@app.get("/export/events")
def export_events(
    # 1. 🌟 รับ Parameters จาก Frontend (ที่ส่งมาจาก onExport)
    start: str | None = Query(None),
    end: str | None = Query(None),
    direction: str | None = Query(None),
    plate: str | None = Query(None) # (Frontend ส่ง "query" มาเป็น "plate")
):
    try:
        # 2.สร้าง Query Builder โดยใช้ Filter
        query_builder = supabase.table("Event").select("*").order("datetime", desc=True)

        if start:
            query_builder = query_builder.gte("datetime", f"{start}T00:00:00")
        if end:
            query_builder = query_builder.lte("datetime", f"{end}T23:59:59")
        if direction and direction.lower() != 'all':
            query_builder = query_builder.eq("direction", direction.upper())
        if plate:
            query_builder = query_builder.ilike("plate", f"%{plate.strip()}%")

        # 3.ดึงข้อมูล
        response = query_builder.execute()
        data = response.data or []
        
        # 4. โค้ดสร้าง CSV
        output = io.StringIO(newline="")
        output.write("\ufeff")  # UTF-8 BOM

        fieldnames = list(data[0].keys()) if data else ["datetime","plate","province","direction","role","image"]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        if data:
            writer.writerows(data)
        output.seek(0)

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=events_filtered.csv"} #ไว้เปลี่ยนชื่อไฟล์
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting events: {str(e)}")


# ====
#  HEALTH CHECK
# ====
@app.get("/")
def root():
    return {"status": "ok", "message": "API is running"}

