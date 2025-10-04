import os
import time
import requests
from OCR_ai import *
from watchdog.events import FileSystemEventHandler, FileSystemEvent
from watchdog.observers import Observer

WATCH_DIR = r"detect_motor"
API_URL_EVENT = "http://127.0.0.1:8000/events"
API_URL_CHECK = "http://127.0.0.1:8000/check_plate"


def send_event(payload: dict):
    """ส่งข้อมูล Event ไปยัง API"""
    r = requests.post(API_URL_EVENT, json=payload, timeout=10)
    r.raise_for_status()
    return r.json()


def check_plate_in_system(plate: str, province: str):
    """เรียก API เพื่อตรวจสอบว่ามีป้ายในระบบหรือไม่"""
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
        print("hello")
        result = read_plate(event.src_path)
        print(result)

        # เช็คในระบบก่อน
        role, vehicle_id = check_plate_in_system(result["plate"], result["province"])
        print(f"Role: {role}, Vehicle ID: {vehicle_id}")

        # เตรียมข้อมูลส่งขึ้น Supabase
        event_payload = {
            "status": role,
            "datetime": result["time"],
            "plate": result["plate"],
            "province": result["province"],
            "direction": result["direction"],
            "blob": None,
            "cam_id": 1,
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
