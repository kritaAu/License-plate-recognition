import requests
import os
import glob

# --- 1. ตั้งค่า ---

# (นี่คือ URL ของ "นักสืบ" - ที่รันบน Port 8000)
SERVER_URL = "http://127.0.0.1:8001/batch/"
IMAGE_DIR = "detect_motor"  # (โฟลเดอร์ที่เราเพิ่งสร้าง)

# --- 2. เตรียมข้อมูล (จำลอง Flutter) ---

# (นี่คือ Form data ที่เป็น Text)
payload = {"batch_id": "python_test_002", "cam_id": 1, "direction": "IN"}

# (นี่คือ Form data ที่เป็น Files)
files_to_send = []
file_objects_to_close = []  # (ที่พักไฟล์ที่เปิด)

try:
    # ค้นหารูป .jpg หรือ .png (จำกัด 10 รูป)
    image_paths = (
        glob.glob(os.path.join(IMAGE_DIR, "*.jpg"))
        + glob.glob(os.path.join(IMAGE_DIR, "*.png"))
    )[:10]

    if not image_paths:
        print(f"[ERROR] ไม่พบรูปภาพในโฟลเดอร์: {IMAGE_DIR}")
        exit()

    print(f"กำลังเตรียมส่ง {len(image_paths)} ไฟล์ ไปยัง {SERVER_URL}...")

    # (วนลูปเพื่อ "เปิด" ไฟล์)
    for file_path in image_paths:
        filename = os.path.basename(file_path)
        file_obj = open(file_path, "rb")
        file_objects_to_close.append(file_obj)  # (เก็บไว้รอปิด)

        # (นี่คือ Syntax การเตรียมไฟล์สำหรับ 'requests')
        # (เราใช้ 'images' (ไม่มี []) ให้ตรงกับ FastAPI)
        files_to_send.append(
            # ('field_name', (filename, file_object, content_type))
            ("images", (filename, file_obj, "image/jpeg"))
        )

    # --- 3. ยิง API (POST Request) ---
    response = requests.post(
        SERVER_URL, data=payload, files=files_to_send
    )

    # --- 4. แสดงผลลัพธ์ ---
    print(f"\n--- 🚀 Server Response (Status: {response.status_code}) ---")

    try:
        print(response.json())
    except requests.exceptions.JSONDecodeError:
        print(response.text)  # (ถ้าล้มเหลว ให้แสดง Text)

except requests.exceptions.ConnectionError:
    print(f"\n[ERROR] เชื่อมต่อ Server ไม่ได้")
    print(f"กรุณาตรวจสอบว่า 'batch_process.py' (Port 8000) ทำงานอยู่หรือไม่")
except Exception as e:
    print(f"\n[ERROR] เกิดข้อผิดพลาด: {e}")

finally:
    # "ปิด" ไฟล์ 10 รูปที่เราเปิดค้างไว้
    for file_obj in file_objects_to_close:
        file_obj.close()
