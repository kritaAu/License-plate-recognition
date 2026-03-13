"""
Utility functions — image cropping, encoding, and storage upload.
"""

import base64
import logging
import uuid
from datetime import datetime

import cv2

from core.database import supabase as _supabase_storage

logger = logging.getLogger("app")


def safe_crop(img, x1, y1, x2, y2, pad=0):
    """Safely crop image with optional padding."""
    h, w = img.shape[:2]
    x1 = max(0, x1 - pad)
    y1 = max(0, y1 - pad)
    x2 = min(w, x2 + pad)
    y2 = min(h, y2 + pad)
    if x2 <= x1 or y2 <= y1:
        return None
    return img[y1:y2, x1:x2]


def encode_image(image):
    """Encode image to base64 string."""
    _, buffer = cv2.imencode(".jpg", image)
    return base64.b64encode(buffer).decode("utf-8")


def upload_image_to_storage(
    image_bytes: bytes, ext="jpg", folder="plates"
) -> str | None:
    """Upload image bytes to Supabase storage and return public URL."""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S-%f")
        filename = f"{folder}/{timestamp}_{uuid.uuid4().hex[:6]}.{ext}"

        bucket = _supabase_storage.storage.from_("image_car")

        res = bucket.upload(filename, image_bytes, {"content-type": f"image/{ext}"})

        if res is None or (
            hasattr(res, "status_code") and res.status_code not in (200, 201)
        ):
            logger.error(f"Upload failed: {res}")
            return None

        url = bucket.get_public_url(filename)
        logger.info(f"Upload success: {url}")
        return url

    except Exception as e:
        logger.error(f"Upload error: {e}")
        return None
