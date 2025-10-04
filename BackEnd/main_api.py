from fastapi import FastAPI, HTTPException, UploadFile, File
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
    direction: str
    status: str | None = "Visitor"  # Visitor, Student, Teacher, Staff
    blob: str | None = None         # image URL (from Storage)


# POST: create Event
@app.post("/events")
def create_event(event: EventIn):
    try:
        direction_map = {1: "IN", 2: "OUT"}
        direction = direction_map.get(event.cam_id, "UNKNOWN")
        response = supabase.table("Event").insert({
            "status": event.status,
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


# POST: upload image and return URL
@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    url = upload_image_to_storage(file, folder="plates")
    return {"url": url}
