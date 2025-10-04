import os
import time
import requests
from OCR_ai import *
from watchdog.events import FileSystemEventHandler, FileSystemEvent
from watchdog.observers import Observer

WATCH_DIR=r"detect_motor"
API_URL = "http://127.0.0.1:8000"

def send_event(payload: dict):
    r = requests.post(f"{API_URL}/events", json=payload, timeout=10)
    r.raise_for_status()
    return r.json()


class ReadImage(FileSystemEventHandler):
    def on_created(self, event:FileSystemEvent):
        if event.is_directory:
            return
        result = read_plate(event.src_path)
        print(result)

        event1 = {
        "status": "Staff",
        "datetime":  result["time"],  
        "plate": result["plate"],
        "province": result["province"],
        "direction": result["direction"],
        "blob": None,
        "cam_id": 1
        }

        try:
            resp = send_event(event1)
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

