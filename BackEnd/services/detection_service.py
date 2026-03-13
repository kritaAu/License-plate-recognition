"""
Detection service — YOLO-based motorcycle and license-plate detection with
scoring heuristics.

Functions in this module are pure image-processing helpers.  They receive YOLO
models as module-level state set via ``init_models()`` so the caller (typically
``batch_service``) can control *when* the heavy model files are loaded.
"""

import io
import logging
from typing import List, Optional

import cv2
import numpy as np
from PIL import Image

from utils import safe_crop

logger = logging.getLogger("detection_service")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
PAD = 10
MIN_CONFIDENCE = 0.3
SCORE_WEIGHTS = {"area": 0.3, "sharpness": 0.3, "confidence": 0.4}

# ---------------------------------------------------------------------------
# Lazy YOLO model references – set by init_models()
# ---------------------------------------------------------------------------
_model_lpr = None
_model_mc = None


def init_models(model_lpr, model_mc=None):
    """Store references to pre-loaded YOLO model instances.

    Parameters
    ----------
    model_lpr : ultralytics.YOLO
        License-plate recognition model.
    model_mc : ultralytics.YOLO, optional
        Motorcycle detection model.
    """
    global _model_lpr, _model_mc
    _model_lpr = model_lpr
    _model_mc = model_mc
    logger.info("Detection models initialised (lpr=%s, mc=%s)", model_lpr, model_mc)


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def blur_score(img_np: np.ndarray) -> float:
    """Convert to grayscale and return the Laplacian variance (sharpness)."""
    gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()


def normalize_area(area: float, max_area: float = 50000) -> float:
    return min(area / max_area, 1.0)


def normalize_sharpness(sharpness: float, max_sharpness: float = 1000) -> float:
    return min(sharpness / max_sharpness, 1.0)


def calculate_plate_score(area: float, sharpness: float, confidence: float) -> float:
    """Weighted composite score for a detected plate."""
    area_norm = normalize_area(area)
    sharp_norm = normalize_sharpness(sharpness)

    score = (
        area_norm * SCORE_WEIGHTS["area"]
        + sharp_norm * SCORE_WEIGHTS["sharpness"]
        + confidence * SCORE_WEIGHTS["confidence"]
    )
    return score


# ---------------------------------------------------------------------------
# Detection functions
# ---------------------------------------------------------------------------

def detect_motorcycle(pil_image: Image.Image, frame_np: np.ndarray) -> List[np.ndarray]:
    """Detect motorcycles in *pil_image* and return cropped regions.

    Falls back to the full frame when no motorcycle is found.
    """
    mc: List[np.ndarray] = []

    if _model_mc is not None:
        try:
            mc_results = _model_mc(pil_image, classes=[3], verbose=False)
            if mc_results[0].boxes and len(mc_results[0].boxes) > 0:
                for box in mc_results[0].boxes.xyxy.cpu().numpy():
                    x1, y1, x2, y2 = map(int, box)
                    cropped = safe_crop(frame_np, x1, y1, x2, y2, pad=PAD)
                    if cropped is not None:
                        mc.append(cropped)
        except Exception as e:
            logger.error("Error in motorcycle detection: %s", e)

    if not mc:
        mc.append(frame_np)

    return mc


def detect_best_plate(mc: np.ndarray) -> Optional[dict]:
    """Run LPR model on a (motorcycle) crop and return the best plate dict."""
    try:
        results = _model_lpr(
            Image.fromarray(mc), classes=[0], verbose=False, conf=MIN_CONFIDENCE
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
            "crop": plate_crop,
            "score": score,
            "confidence": float(conf),
            "area": float(area),
            "sharpness": float(sharpness),
        }
    except Exception as e:
        logger.error("Error in plate detection: %s", e)
        return None


def process_img(image_bytes: bytes, filename: str) -> Optional[dict]:
    """Full pipeline: open image -> detect motorcycles -> detect best plate."""
    try:
        pil_image = Image.open(io.BytesIO(image_bytes))
        frame_np = np.array(pil_image)

        mcs = detect_motorcycle(pil_image, frame_np)

        best_plate = None
        for mc in mcs:
            plate_info = detect_best_plate(mc)

            if plate_info and (
                best_plate is None or plate_info["score"] > best_plate["score"]
            ):
                best_plate = plate_info

            if best_plate:
                return {
                    **best_plate,
                    "full_image_bytes": image_bytes,
                    "filename": filename,
                }
            return None
    except Exception as e:
        logger.error("Error processing image %s: %s", filename, e)
        return None
