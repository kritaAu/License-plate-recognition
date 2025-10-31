import base64
import cv2
import time as systime
from datetime import datetime, timezone, timedelta
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


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


# Upload image bytes to Supabase Storage (bucket = image_car)
# Returns the public URL of the uploaded image
def upload_image_to_storage(
    image_bytes: bytes, ext="jpg", folder="plates"
) -> str | None:
    try:
        # ตั้งชื่อไฟล์ไม่ให้ชน โดยใส่ microsecond + UUID
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S-%f")
        filename = f"{folder}/{timestamp}_{uuid.uuid4().hex[:6]}.{ext}"

        # เลือก bucket
        bucket = supabase.storage.from_("image_car")

        # อัปโหลดไฟล์ไปยัง bucket
        res = bucket.upload(filename, image_bytes, {"content-type": f"image/{ext}"})

        # ตรวจสอบผลลัพธ์จาก upload
        if res is None or (
            hasattr(res, "status_code") and res.status_code not in (200, 201)
        ):
            print(f"Upload failed: {res}")
            return None

        # ดึง URL ที่เข้าถึงได้สาธารณะ
        url = bucket.get_public_url(filename)
        print(f"[UPLOAD SUCCESS] {url}")
        return url

    except Exception as e:
        print("Upload error:", e)
        return None
