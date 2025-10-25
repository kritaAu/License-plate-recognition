import base64, cv2
import time as systime
from datetime import datetime, timezone, timedelta



def safe_crop(img, x1, y1, x2, y2, pad=0):
    h, w = img.shape[:2]
    x1 = max(0, x1 - pad)
    y1 = max(0, y1 - pad)
    x2 = min(w, x2 + pad)
    y2 = min(h, y2 + pad)
    if x2 <= x1 or y2 <= y1:
        return None
    return img[y1:y2, x1:x2]


def encode_image(image):
    _, buffer = cv2.imencode(".jpg", image)
    return base64.b64encode(buffer).decode("utf-8")


def dt_to_iso(dt_str: str) -> str:
    # จาก "2025-11-03_14-30-00"
    dt = datetime.strptime(dt_str, "%Y-%m-%d_%H-%M-%S")
    dt = dt.replace(tzinfo=timezone(timedelta(hours=7)))
    return dt.isoformat()  # "2025-11-03T14:30:00+07:00"


def open_camera(rtsp_url):
    cap = None
    while cap is None or not cap.isOpened():
        print("ไม่สามารถเชื่อมต่อกล้องได้... กำลังลองใหม่ใน 3 วินาที")
        systime.sleep(3)
        cap = cv2.VideoCapture(rtsp_url)
    print("กล้องเชื่อมต่อสำเร็จ")
    return cap