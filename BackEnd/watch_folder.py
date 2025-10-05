import os, time, base64, requests, cv2
import numpy as np
from utils import *
from OCR_ai import *
from ultralytics import YOLO
from watchdog.events import FileSystemEventHandler, FileSystemEvent
from watchdog.observers import Observer

WATCH_DIR = r"detect_motor"
API_URL_EVENT = "http://127.0.0.1:8000/events"
API_URL_CHECK = "http://127.0.0.1:8000/check_plate"
model = YOLO("model/lpr_model.pt")


def send_event(payload: dict):
    """ส่งข้อมูล Event ไปยัง API"""
    r = requests.post(API_URL_EVENT, json=payload, timeout=10)
    r.raise_for_status()
    return r.json()


def check_plate_in_system(plate: str, province: str):
    ##เรียก API เพื่อตรวจสอบว่ามีป้ายในระบบหรือไม่##
    try:
        params = {"plate": plate, "province": province}
        r = requests.get(API_URL_CHECK, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()

        if data.get("exists"):
            role = data.get("role", "Visitor")
            vehicle_id = data.get("vehicle_id", None)
            return role, vehicle_id

        return "Visitor", None

    except Exception as e:
        print("Error checking plate:", e)
        return "Visitor", None


class ReadImage(FileSystemEventHandler):
    def on_created(self, event: FileSystemEvent):
        if event.is_directory:
            return
        time.sleep(0.1)

        img = cv2.imread(event.src_path)
        if img is None:
            print(f"[WARN] อ่านภาพไม่ได้: {event.src_path}")
            return
        result_p = model.predict(source=event.src_path, imgsz=960, device="0", classes=[0])

        filename = os.path.basename(event.src_path)
        match = re.search(r"^Cam_(\d+)_Dir_(.*?)_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})", filename)
        if match:
            cam = match.group(1)
            direction = match.group(2)
            dt = match.group(3)
            iso_dt = dt_to_iso(dt)   

            print("Camera:", cam)
            print("Direction:", direction)
            print("Datetime:", dt)
            print("DatetimeISO:", iso_dt)
        else:
            print("ไม่ตรง pattern")
        
        if result_p and len(result_p[0].boxes) > 0:
            boxes = result_p[0].boxes.xyxy.cpu().numpy()  
            confs = result_p[0].boxes.conf.cpu().numpy()

            best_i = int(np.argmax(confs))
            x1, y1, x2, y2 = map(int, boxes[best_i])

            crop = safe_crop(img, x1, y1, x2, y2, pad=10)

        if crop is not None and crop.size > 0:
            # อ่านป้ายทะเบียนจากภาพ
            img_b64 = encode_image(crop)
            result = read_plate(img_b64=img_b64, image_path=event.src_path)
            print(result)

            # เช็คป้ายในระบบหลังจากได้ผลลัพธ์จาก OCR แล้ว
            role, vehicle_id = check_plate_in_system(result["plate"], result["province"]) 
            print(f"Role: {role}, Vehicle ID: {vehicle_id}")

            # เตรียมข้อมูลส่งขึ้น Supabase
            event_payload = {
                "datetime": result["time"],
                "plate": result["plate"],
                "province": result["province"],
                "direction": result["direction"],
                "blob": None,
                "cam_id": int(cam),
                "vehicle_id": vehicle_id
            }

        try:
            resp = send_event(event_payload)
            print(resp)
            print("Insert Complete")
        except requests.HTTPError as e:
            print("HTTP error:", e.response.text)
        except Exception as e:
            print("Error:", str(e))

def main():
    if not os.path.isdir(WATCH_DIR):
        print(f"[ERROR] Folder not found: {WATCH_DIR}")
        return

    print(f"[WATCH] Watching: {WATCH_DIR}")
    observer = Observer()
    observer.schedule(ReadImage(), WATCH_DIR, recursive=False)
    observer.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        observer.stop()
        observer.join()
        print("[STOP] Done.")


if __name__ == "__main__":
    main()