import os,requests,cv2,io,base64
from dotenv import load_dotenv
from ultralytics import YOLO
from supabase import create_client
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
import numpy as np
from typing import List, Optional, Tuple
from PIL import Image
from utils import *
from datetime import datetime
import uvicorn
from OCR_ai import *

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

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

API_URL_EVENT = "https://license-plate-recognition-wlxn.onrender.com/events"
API_URL_CHECK = "https://license-plate-recognition-wlxn.onrender.com/check_plate"
PAD = 10
MIN_CONFIDENCE = 0.3
SCORE_WEIGHTS = {
    'area': 0.3,
    'sharpness': 0.3,
    'confidence': 0.4
}

app = FastAPI()

def send_event(payload:dict):
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

# เปลี่ยนเป็นขาวดำแล้ววัดค่าความคม คืนเป็น float
def blur_score(img_np):
    gray = cv2.cvtColor(img_np,cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray,cv2.CV_64F).var()

def normalize_area(area: float, max_area: float = 50000) -> float:
    return min(area / max_area, 1.0)

def normalize_sharpness(sharpness: float, max_sharpness: float = 1000) -> float:
    return min(sharpness / max_sharpness, 1.0)

# คำนวณ score ของแต่ละป้าย
def calculate_plate_score(area: float, sharpness: float, confidence: float) -> float:
    area_norm = normalize_area(area)
    sharp_norm = normalize_sharpness(sharpness)
    
    score = (
        area_norm * SCORE_WEIGHTS['area'] +
        sharp_norm * SCORE_WEIGHTS['sharpness'] +
        confidence * SCORE_WEIGHTS['confidence']
    )
    
    return score

# ตรวจหามอไซ คืนมอไซ
def detect_motorcycle(pil_image:Image.Image,frame_np:np.ndarray)->List[np.ndarray]:
    mc = []

    if model_mc:
        try:
            mc_results = model_mc(pil_image, classes=[3], verbose=False)
            if mc_results[0].boxes and len(mc_results[0].boxes) > 0:
                for box in mc_results[0].boxes.xyxy.cpu().numpy():
                    x1, y1, x2, y2 = map(int, box)
                    cropped = safe_crop(frame_np, x1, y1, x2, y2, pad=PAD)
                    if cropped is not None:
                        mc.append(cropped)
        except Exception as e:
            print(f"Error in motorcycle detection: {e}")
    
    if not mc:
        mc.append(frame_np)
    
    return mc

# หาป้ายที่ดีจากการคำนวณคะแนน
def detect_best_plate(mc:np.ndarray)->Optional[dict]:
    try:
        results = model_lpr(
            Image.fromarray(mc), 
            classes=[0], 
            verbose=False, 
            conf=MIN_CONFIDENCE
        )

        if not results[0].boxes or len(results[0].boxes) == 0:
            return None
        
        confs = results[0].boxes.conf.cpu().numpy()
        boxes = results[0].boxes.xyxy.cpu().numpy()
        areas = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])

        best_idx = areas.argmax()
        conf, box, area = confs[best_idx], boxes[best_idx], areas[best_idx]

        if conf < MIN_CONFIDENCE:
            return None
        
        sharpness = blur_score(mc)
        score = calculate_plate_score(area, sharpness, conf)

        plate_crop = safe_crop(mc, *map(int, box), pad=PAD)
        if plate_crop is None:
            return None
        
        return {
            'crop': plate_crop,
            'score': score,
            'confidence': float(conf),
            'area': float(area),
            'sharpness': float(sharpness)
        }
    except Exception as e:
        print(f"Error in plate detection: {e}")
        return None

# เรียกใช้สองที่หามอไซกับป้ายแล้วเปรียบเทียบคะแนน
def process_img(image_bytes: bytes, filename: str)->Optional[dict]:
    try:
        pil_image = Image.open(io.BytesIO(image_bytes))
        frame_np = np.array(pil_image)

        mcs = detect_motorcycle(pil_image,frame_np)

        best_plate = None
        for mc in mcs:
            plate_info = detect_best_plate(mc)

            if plate_info and(best_plate is None or plate_info['score']>best_plate['score']):
                best_plate = plate_info
            
            if best_plate:
                return {
                    **best_plate,
                    'full_image_bytes': image_bytes,
                    'filename': filename
                }
            return None
    except Exception as e:
        print(f"Error processing image {filename}: {e}")
        return None

# ส่งภาพที่ครอปไป OCR
def perform_ocr(plate_crop: np.ndarray) -> Tuple[Optional[str], Optional[str]]:
    try:
        _, buffer = cv2.imencode(".jpg", plate_crop)
        img_b64 = base64.b64encode(buffer).decode("utf-8")
        ocr_result = read_plate(img_b64=img_b64)
        
        plate_text = ocr_result.get("plate")
        province_text = ocr_result.get("province")
        
        return plate_text, province_text
        
    except Exception as e:
        print(f"OCR error: {e}")
        return None, None

def upload_image(image_bytes: bytes) -> Optional[str]:
    try:
        return upload_image_to_storage(image_bytes, ext="jpg", folder="plates")
    except Exception as e:
        print(f"Image upload error: {e}")
        return None
    
@app.get("/")
def root():
    return {"message": "Hello Test"}

@app.post("/batch")
async def handle_flutter_batch(
    images: List[UploadFile] = File(...),
    batch_id: str = Form(...),
    cam_id: int = Form(...),
    direction: str = Form(...),
):
    if not images:
        raise HTTPException(status_code=400, detail="No images provided")
    
    print(f"\n{'='*60}")
    print(f"Batch Received: {batch_id}")
    print(f"Camera: {cam_id} | Direction: {direction} | Images: {len(images)}")
    print(f"{'='*60}\n")

    best_result = None
    first_image_bytes = None

    for i ,file in enumerate(images):
        try:
            image_bytes = await file.read()

            if i == 0:
                first_image_bytes = image_bytes

            result = process_img(image_bytes, file.filename)

            if result and (best_result is None or result['score'] > best_result['score']):
                best_result = result
                print(f" New best plate found in {file.filename}")
                print(f"  Score: {result['score']:.3f} | Conf: {result['confidence']:.2f} | Area: {result['area']:.0f}")
        except Exception as e:
            print(f" Failed to process {file.filename}: {e}")
            continue

    if best_result:
        print(f"\n Best plate selected from {best_result['filename']}")
        
        #ส่งไป ocr
        plate_text, province_text = perform_ocr(best_result['crop'])
        
        #อัพรูป
        image_url = upload_image(best_result['full_image_bytes'])
        
        #เช็ครถในระบบ
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
        
        print(f"Plate: {plate_text} | Province: {province_text}")
        
    else:
        print("\n No license plate detected in batch")
        
        # Upload first image as fallback
        image_url = upload_image(first_image_bytes) if first_image_bytes else None
        
        event_payload = {
            "datetime": datetime.now().isoformat(),
            "plate": "ไม่มีป้ายทะเบียน",
            "province": None,
            "direction": direction,
            "blob": image_url,
            "cam_id": cam_id,
            "vehicle_id": None,
        }
    
    print(f"{'='*60}\n")
    
    return send_event(event_payload)

if __name__ == "__main__":
    print("http://0.0.0.0:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001)