import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from typing import List
import io
from supabase import create_client
from PIL import Image
import os
from ultralytics import YOLO
import numpy as np
import requests
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
    model_lpr = YOLO("model/lpr_model.pt")
    model_mc = YOLO("model/motorcycle_model.pt")
    print("โหลด YOLO สำเร็จ")
except Exception as e:
    print(f"!!! ไม่พบโมเดล 'model/lpr_model.pt': {e}")
    exit()

try:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("Supabase Client (AI Server) โหลดสำเร็จ")
except Exception as e:
    print(f"!!! ไม่สามารถเชื่อมต่อ Supabase: {e}")
    supabase = None

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
        raise HTTPException(
            status_code=502, detail=f"API Server Error: {e.response.text}"
        )
    except Exception as e:
        print(f"[ERROR] เชื่อมต่อ API Server (/events) ไม่ได้: {e}")
        raise HTTPException(
            status_code=503, detail=f"Cannot connect to API Server: {e}"
        )


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


@app.get("/")
def root():
    return {"message": "FastAPI is running!"}


@app.post("/batch")
async def handle_flutter_batch(
    images: List[UploadFile] = File(...),
    batch_id: str = Form(...),
    cam_id: int = Form(...),
    direction: str = Form(...),
):

    print(f"---Server: Batch Received ---")
    print(f"Batch ID: {batch_id}, Cam ID: {cam_id}, Direction: {direction}")
    print(f"File Count: {len(images)}")

    best_plate_conf = 0.0
    best_plate_crop_np = None
    best_full_image_bytes = None
    best_filename = ""
    best_frame_np = None
    first_image_bytes = None

    for i,file in enumerate(images):
        image_bytes = await file.read()
        if i == 0:
            first_image_bytes = image_bytes
        pil_image = Image.open(io.BytesIO(image_bytes))
        frame_np = np.array(pil_image)
        plate_candidates = []

        if model_mc:
            mc_results = model_mc(pil_image, classes=[3], verbose=False, device=0)
            if mc_results[0].boxes and len(mc_results[0].boxes) > 0:
                for box in mc_results[0].boxes.xyxy.cpu().numpy():
                    x1, y1, x2, y2 = map(int, box)
                    plate_candidates.append(safe_crop(frame_np, x1, y1, x2, y2, pad=PAD))

        # fallback ตรวจป้ายเต็มภาพ
        if not plate_candidates:
            plate_candidates.append(frame_np)

        # ตรวจป้ายทุก candidate
        for candidate in plate_candidates:
            results = model_lpr(Image.fromarray(candidate), classes=[0], verbose=False)
            if results[0].boxes:
                try:
                    confs = results[0].boxes.conf.cpu().numpy()
                    boxes = results[0].boxes.xyxy.cpu().numpy()
                    best_idx = confs.argmax()
                    conf, box = confs[best_idx], boxes[best_idx]

                    if conf > best_plate_conf:
                        best_plate_conf = conf
                        best_plate_crop_np = safe_crop(candidate, *map(int, box), pad=PAD)
                        best_full_image_bytes = image_bytes
                        best_frame_np = candidate
                        best_filename = file.filename
                except Exception:
                    continue

    if best_plate_crop_np is not None:
        print(f"Best file: {best_filename}")
        print(f"Best frame shape: {best_frame_np.shape}")                
    # หลังวนครบ batch
    if best_plate_crop_np is None:
        print("ไม่พบป้ายทะเบียนใน Batch นี้")
        image_to_upload = first_image_bytes or await images[0].read()
        try:
            image_url = upload_image_to_storage(image_to_upload, ext="jpg", folder="plates")
        except Exception:
            image_url = None

        event_payload = {
            "datetime": datetime.now().isoformat(),
            "plate": "ไม่มีป้ายทะเบียน",
            "province": None,
            "direction": direction,
            "blob": image_url,
            "cam_id": cam_id,
            "vehicle_id": None,
        }
        return send_event(event_payload)

    # ถ้าเจอป้าย
    _, buffer = cv2.imencode(".jpg", best_plate_crop_np)
    img_b64 = base64.b64encode(buffer).decode("utf-8")
    ocr_result = read_plate(img_b64=img_b64)
    plate_text = ocr_result.get("plate", None)
    province_text = ocr_result.get("province", None)

    try:
        image_url = upload_image_to_storage(best_full_image_bytes, ext="jpg", folder="plates")
    except Exception:
        image_url = None

    vehicle_id = check_plate_in_system(plate_text, province_text)
    event_payload = {
        "datetime": datetime.now().isoformat(),
        "plate": plate_text,
        "province": province_text,
        "direction": direction,
        "blob": image_url,
        "cam_id": cam_id,
        "vehicle_id": vehicle_id,
    }
    return send_event(event_payload)

if __name__ == "__main__":
    print("http://0.0.0.0:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001)
