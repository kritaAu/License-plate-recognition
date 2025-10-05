from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from supabase import create_client
import os
from pydantic import BaseModel
from dotenv import load_dotenv
from datetime import datetime
import uuid

#  ENV 
load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase = create_client(url, key)

#  FASTAPI APP 
app = FastAPI()

#  HELPERS 
def upload_image_to_storage(file: UploadFile, folder="plates") -> str:
    """
    Upload image to Supabase Storage (bucket = image_car) and return public URL
    """
    try:
        #unique filename
        ext = file.filename.split(".")[-1]
        filename = f"{folder}/{uuid.uuid4().hex}.{ext}"
        #read file bytes
        content = file.file.read()
        #upload to bucket = image_car
        supabase.storage.from_("image_car").upload(filename, content)
        #return public URL
        url = supabase.storage.from_("image_car").get_public_url(filename)
        return url

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")


#--ROUTES--

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
    datetime: datetime   # event timestamp
    plate: str           # license plate
    province: str        # province
    cam_id: int          # 1 = IN, 2 = OUT
    blob: str | None = None         # image URL (from Storage)


# POST: create Event
@app.post("/events")
def create_event(event: EventIn):
    try:
        direction_map = {1: "IN", 2: "OUT"}
        direction = direction_map.get(event.cam_id, "UNKNOWN")

        response = supabase.table("Event").insert({
            "datetime": event.datetime.isoformat(),
            "plate": event.plate,
            "province": event.province,
            "direction": direction,
            "blob": event.blob,   # already URL
            "cam_id": event.cam_id
        }).execute()

        if not response.data:
            raise HTTPException(status_code=400, detail="Insert failed")

        return {"message": "Event created successfully", "data": response.data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# GET: Check plate in member

@app.get("/check_plate")
def check_plate(
    plate: str | None = Query(None, description="ทะเบียนรถ เช่น กข 1234"),
    province: str | None = Query(None, description="จังหวัด เช่น กรุงเทพมหานคร")
):
    try:
        query = supabase.table("Vehicle") \
            .select("vehicle_id, plate, province, member:Member!Vehicle_member_id_fkey(role)")

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
                "role": role
            }

        return {"exists": False, "message": "This plate is not registered."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# POST: upload image and return URL
@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    url = upload_image_to_storage(file, folder="plates")
    return {"url": url}
