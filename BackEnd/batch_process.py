import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from typing import List
import io
from supabase import create_client # ⬅️
from PIL import Image
import os
from ultralytics import YOLO
import numpy as np
import requests
import time
from datetime import datetime
from dotenv import load_dotenv
import base64
import cv2
from utils import * 
from OCR_ai import read_plate 

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

print("กำลังโหลดโมเดล YOLO (License Plate)...")
try:
    model = YOLO("model/lpr_model.pt") 
    print("โหลด YOLO (License Plate) สำเร็จ")
except Exception as e:
    print(f"!!! ไม่พบโมเดล 'model/lpr_model.pt': {e}")
    exit()

try:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("Supabase Client (AI Server) โหลดสำเร็จ")
except Exception as e:
    print(f"!!! ไม่สามารถเชื่อมต่อ Supabase: {e}")
    supabase = None # (ตั้งเป็น None ถ้าล้มเหลว)

API_URL_EVENT = "http://127.0.0.1:8000/events"
API_URL_CHECK = "http://127.0.0.1:8000/check_plate"
PAD = 10 

app = FastAPI()

def send_event(payload: dict):
    try:
        r = requests.post(API_URL_EVENT, json=payload, timeout=10)
        r.raise_for_status()
        return r.json()
    except requests.HTTPError as e:
        print(f"[ERROR] API Server (/events) ปฏิเสธ: {e.response.text}")
        raise HTTPException(status_code=502, detail=f"API Server Error: {e.response.text}")
    except Exception as e:
        print(f"[ERROR] เชื่อมต่อ API Server (/events) ไม่ได้: {e}")
        raise HTTPException(status_code=503, detail=f"Cannot connect to API Server: {e}")

def check_plate_in_system(plate: str, province: str):
    try:
        params = {"plate": plate, "province": province}
        r = requests.get(API_URL_CHECK, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        if data.get("exists"):
            return data.get("vehicle_id", None)
        return None
    except Exception as e:
        print(f"[ERROR] เชื่อมต่อ API Server (/check_plate) ไม่ได้: {e}")
        return None

@app.post("/process-batch/")
async def handle_flutter_batch(
    images: List[UploadFile] = File(...), 
    batch_id: str = Form(...),
    cam_id: int = Form(...),
    direction: str = Form(...)
):
    
    print(f"---Server: Batch Received ---")
    print(f"Batch ID: {batch_id}, Cam ID: {cam_id}, Direction: {direction}")
    print(f"File Count: {len(images)}")

    best_plate_conf = 0.0
    best_plate_crop_np = None 
    best_full_image_bytes = None 
    best_filename = ""

    for file in images:
        image_bytes = await file.read()
        pil_image = Image.open(io.BytesIO(image_bytes))

        results = model(pil_image, classes=[0], verbose=False) 
        
        current_best_conf = 0.0
        current_best_box = None

        if results[0].boxes: 
            try:
                all_confs = results[0].boxes.conf.cpu().numpy()
                best_index_in_image = all_confs.argmax() 
                current_best_conf = all_confs[best_index_in_image]
                current_best_box = results[0].boxes.xyxy.cpu().numpy()[best_index_in_image]
            except Exception as e:
                current_best_conf = 0.0
        
        print(f"File: {file.filename}, Best Plate Conf: {current_best_conf:.2f}")

        if current_best_conf > best_plate_conf:
            best_plate_conf = current_best_conf
            best_filename = file.filename
            best_full_image_bytes = image_bytes 
            
            x1, y1, x2, y2 = map(int, current_best_box)
            frame_np = np.array(pil_image) 
            best_plate_crop_np = safe_crop(frame_np, x1, y1, x2, y2, pad=PAD)

    if best_plate_crop_np is None:
        print("ไม่พบป้ายทะเบียนใน Batch นี้")
        raise HTTPException(status_code=404, detail="No license plate found in batch")

    print(f"---Best Image Found: {best_filename} (Plate Conf: {best_plate_conf:.2f}) ---")
    
    success, buffer = cv2.imencode('.jpg', best_plate_crop_np)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to encode crop image")
    img_b64 = base64.b64encode(buffer).decode('utf-8')

    iso_dt = datetime.now().isoformat()

    ocr_result = read_plate(
        img_b64=img_b64, 
        iso_dt=iso_dt, 
        direction=direction,
        cam_id=cam_id
    ) 
    
    if not ocr_result or ocr_result.get("plate") == "ไม่มีป้ายทะเบียน" or ocr_result.get("plate") is None:
        print(f"GPT-4o ไม่สามารถอ่านป้ายทะเบียนได้: {ocr_result}")
        raise HTTPException(status_code=400, detail="OCR (GPT-4o) failed to read plate")

    plate_text = ocr_result["plate"]
    province_text = ocr_result.get("province")
    print(f"Result: {plate_text} | {province_text} ---")

    try:
        image_url = upload_image_to_storage(
            best_full_image_bytes, ext="jpg", folder="plates"
        )
        print(f"อัปโหลดรูปขึ้น Storage สำเร็จ: {image_url}")
    except Exception as e:
        print(f"อัปโหลดรูปขึ้น Storage ล้มเหลว: {e}")
        image_url = None

    print(f"กำลังเช็คป้าย: {plate_text} {province_text}")
    vehicle_id = check_plate_in_system(plate_text, province_text)
    if vehicle_id:
        print(f"พบป้ายในระบบ: ID = {vehicle_id}")
    else:
        print("ไม่พบป้ายในระบบ (Visitor)")

    event_payload = {
        "datetime": iso_dt,
        "plate": plate_text,
        "province": province_text,
        "direction": direction,
        "blob": image_url,
        "cam_id": cam_id,
        "vehicle_id": vehicle_id,
    }
    
    try:
        print("กำลังส่ง Event ไปยัง API Server...")
        resp = send_event(event_payload)
        print("ส่ง Event สำเร็จ:", resp)
        return resp 
        
    except HTTPException as e:
        raise e
    except Exception as e:
        print("Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    print("http://0.0.0.0:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001)