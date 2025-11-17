import os
import io
import base64
from datetime import datetime
import cv2
import numpy as np
from PIL import Image
from dotenv import load_dotenv
from ultralytics import YOLO
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from typing import List, Optional, Tuple
from supabase import create_client
import requests
from utils import *
from OCR_ai import read_plate
import uvicorn


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
MIN_CONFIDENCE = 0.3
SCORE_WEIGHTS = {
    'area': 0.3,
    'sharpness': 0.3,
    'confidence': 0.4
}


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


def blur_score(img_np):
    gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()

#ปรับค่า area ให้ไม่เกิน 1 
def normalize_area(area: float, max_area: float = 50000) -> float:
    return min(area / max_area, 1.0)

#ปรับค่า sharpness ให้ไม่เกิน 1 
def normalize_sharpness(sharpness: float, max_sharpness: float = 1000) -> float:
    return min(sharpness / max_sharpness, 1.0)

def calculate_plate_score(area: float, sharpness: float, confidence: float) -> float:
    """
    Calculate normalized score for plate detection quality
    
    Args:
        area: Bounding box area in pixels
        sharpness: Blur score (higher = sharper)
        confidence: Model confidence (0-1)
    
    Returns:
        Normalized score (0-1)
    """
    area_norm = normalize_area(area)
    sharp_norm = normalize_sharpness(sharpness)
    
    score = (
        area_norm * SCORE_WEIGHTS['area'] +
        sharp_norm * SCORE_WEIGHTS['sharpness'] +
        confidence * SCORE_WEIGHTS['confidence']
    )
    
    return score

# ครอปภาพมอไซเข้า regions
def detect_motorcycle_regions(pil_image: Image.Image, frame_np: np.ndarray) -> List[np.ndarray]:
    regions = []
    
    if model_mc:
        try:
            mc_results = model_mc(pil_image, classes=[3], verbose=False)
            if mc_results[0].boxes and len(mc_results[0].boxes) > 0:
                for box in mc_results[0].boxes.xyxy.cpu().numpy():
                    x1, y1, x2, y2 = map(int, box)
                    cropped = safe_crop(frame_np, x1, y1, x2, y2, pad=PAD)
                    if cropped is not None:
                        regions.append(cropped)
        except Exception as e:
            print(f"Error in motorcycle detection: {e}")

    if not regions:
        regions.append(frame_np)
    
    return regions

def detect_best_plate_in_region(region: np.ndarray) -> Optional[dict]:
    """
    Detect best license plate in a given region
    
    Returns:
        Dictionary with plate info or None
    """
    try:
        results = model_lpr(
            Image.fromarray(region), 
            classes=[0], 
            verbose=False, 
            conf=MIN_CONFIDENCE
        )
        
        if not results[0].boxes or len(results[0].boxes) == 0:
            return None
        
        confs = results[0].boxes.conf.cpu().numpy()
        boxes = results[0].boxes.xyxy.cpu().numpy()
        areas = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
        
        # Find plate with largest area
        best_idx = areas.argmax()
        conf, box, area = confs[best_idx], boxes[best_idx], areas[best_idx]
        
        # Skip if confidence too low
        if conf < MIN_CONFIDENCE:
            return None
        
        # Calculate quality score
        sharpness = blur_score(region)
        score = calculate_plate_score(area, sharpness, conf)
        
        # Crop plate region
        plate_crop = safe_crop(region, *map(int, box), pad=PAD)
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

def process_single_image(image_bytes: bytes, filename: str) -> Optional[dict]:
    """
    Process a single image and find best plate
    
    Returns:
        Dictionary with plate detection result or None
    """
    try:
        pil_image = Image.open(io.BytesIO(image_bytes))
        frame_np = np.array(pil_image)
        
        # Detect motorcycle regions
        regions = detect_motorcycle_regions(pil_image, frame_np)
        
        # Find best plate across all regions
        best_plate = None
        for region in regions:
            plate_info = detect_best_plate_in_region(region)
            
            if plate_info and (best_plate is None or plate_info['score'] > best_plate['score']):
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

def perform_ocr(plate_crop: np.ndarray) -> Tuple[Optional[str], Optional[str]]:
    """
    Perform OCR on plate crop
    
    Returns:
        Tuple of (plate_text, province_text)
    """
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

def upload_image_safe(image_bytes: bytes) -> Optional[str]:
    """
    Safely upload image to storage
    
    Returns:
        Image URL or None if failed
    """
    try:
        return upload_image_to_storage(image_bytes, ext="jpg", folder="plates")
    except Exception as e:
        print(f"Image upload error: {e}")
        return None

@app.get("/")
def root():
    return {"message": "FastAPI is running!"}

# Main Endpoint
@app.post("/batch")
async def handle_flutter_batch(
    images: List[UploadFile] = File(...),
    batch_id: str = Form(...),
    cam_id: int = Form(...),
    direction: str = Form(...),
):
    """
    Handle batch of images from Flutter app
    Find best license plate detection across all images
    """
    
    # Validation
    if not images:
        raise HTTPException(status_code=400, detail="No images provided")
    
    print(f"\n{'='*60}")
    print(f"Batch Received: {batch_id}")
    print(f"Camera: {cam_id} | Direction: {direction} | Images: {len(images)}")
    print(f"{'='*60}\n")
    
    best_result = None
    first_image_bytes = None
    
    # Process each image
    for i, file in enumerate(images):
        try:
            image_bytes = await file.read()
            
            # Keep first image as fallback
            if i == 0:
                first_image_bytes = image_bytes
            
            # Process image
            result = process_single_image(image_bytes, file.filename)
            
            # Update best result
            if result and (best_result is None or result['score'] > best_result['score']):
                best_result = result
                print(f"✓ New best plate found in {file.filename}")
                print(f"  Score: {result['score']:.3f} | Conf: {result['confidence']:.2f} | Area: {result['area']:.0f}")
            
        except Exception as e:
            print(f"✗ Failed to process {file.filename}: {e}")
            continue
    
    # Build event payload
    if best_result:
        print(f"\n✓ Best plate selected from {best_result['filename']}")
        
        # Perform OCR
        plate_text, province_text = perform_ocr(best_result['crop'])
        
        # Upload full image
        image_url = upload_image_safe(best_result['full_image_bytes'])
        
        # Check if vehicle exists in system
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
        print("\n✗ No license plate detected in batch")
        
        # Upload first image as fallback
        image_url = upload_image_safe(first_image_bytes) if first_image_bytes else None
        
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
