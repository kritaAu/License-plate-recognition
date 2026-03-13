import os
import sys
import logging
import requests
import cv2
import base64
from dotenv import load_dotenv
from ultralytics import YOLO
from supabase import create_client
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from typing import List, Optional, Tuple
from datetime import datetime
import uvicorn

# Ensure project root is on sys.path so shared modules (utils, etc.) are importable.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from utils import upload_image_to_storage  # noqa: E402
from services.ocr_service import read_plate  # noqa: E402
from services.detection_service import (  # noqa: E402
    init_models,
    process_img,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("batch_service")

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# ---------------------------------------------------------------------------
# YOLO models
# ---------------------------------------------------------------------------
try:
    model_lpr = YOLO("model/lpr_model.pt")
    model_mc = YOLO("model/motorcycle_model.pt")
    init_models(model_lpr, model_mc)
    logger.info("YOLO models loaded successfully")
except Exception as e:
    logger.error("Failed to load YOLO model 'model/lpr_model.pt': %s", e)
    exit()

# ---------------------------------------------------------------------------
# Supabase (own client – this service runs as a separate process)
# ---------------------------------------------------------------------------
try:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("Supabase Client (AI Server) loaded successfully")
except Exception as e:
    logger.error("Cannot connect to Supabase: %s", e)
    supabase = None

# ---------------------------------------------------------------------------
# API URLs (configurable via environment variables)
# ---------------------------------------------------------------------------
API_URL_EVENT = os.getenv(
    "API_URL_EVENT",
    "https://license-plate-recognition-wlxn.onrender.com/events",
)
API_URL_CHECK = os.getenv(
    "API_URL_CHECK",
    "https://license-plate-recognition-wlxn.onrender.com/check_plate",
)

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI()


def send_event(payload: dict):
    try:
        r = requests.post(API_URL_EVENT, json=payload, timeout=10)
        r.raise_for_status()
        return r.json()
    except requests.HTTPError as e:
        logger.error("API Server (/events) rejected: %s", e.response.text)
        raise HTTPException(
            status_code=502, detail=f"API Server Error: {e.response.text}"
        )
    except Exception as e:
        logger.error("Cannot connect to API Server (/events): %s", e)
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
        logger.error("Cannot connect to API Server (/check_plate): %s", e)
        return None


def perform_ocr(plate_crop) -> Tuple[Optional[str], Optional[str]]:
    try:
        _, buffer = cv2.imencode(".jpg", plate_crop)
        img_b64 = base64.b64encode(buffer).decode("utf-8")
        ocr_result = read_plate(img_b64=img_b64)

        plate_text = ocr_result.get("plate")
        province_text = ocr_result.get("province")

        return plate_text, province_text

    except Exception as e:
        logger.error("OCR error: %s", e)
        return None, None


def upload_image(image_bytes: bytes) -> Optional[str]:
    try:
        return upload_image_to_storage(image_bytes, ext="jpg", folder="plates")
    except Exception as e:
        logger.error("Image upload error: %s", e)
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

    logger.info(
        "Batch Received: %s | Camera: %s | Direction: %s | Images: %d",
        batch_id, cam_id, direction, len(images),
    )

    best_result = None
    first_image_bytes = None

    for i, file in enumerate(images):
        try:
            image_bytes = await file.read()

            if i == 0:
                first_image_bytes = image_bytes

            result = process_img(image_bytes, file.filename)

            if result and (
                best_result is None or result["score"] > best_result["score"]
            ):
                best_result = result
                logger.info(
                    " New best plate found in %s | Score: %.3f | Conf: %.2f | Area: %.0f",
                    file.filename,
                    result["score"],
                    result["confidence"],
                    result["area"],
                )
        except Exception as e:
            logger.warning("Failed to process %s: %s", file.filename, e)
            continue

    if best_result:
        logger.info("Best plate selected from %s", best_result["filename"])

        plate_text, province_text = perform_ocr(best_result["crop"])

        image_url = upload_image(best_result["full_image_bytes"])

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

        logger.info("Plate: %s | Province: %s", plate_text, province_text)

    else:
        logger.info("No license plate detected in batch")

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

    return send_event(event_payload)


if __name__ == "__main__":
    logger.info("Starting batch service at http://0.0.0.0:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001)
