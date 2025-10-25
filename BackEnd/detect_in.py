import cv2
import torch
import time
from utils import *
from datetime import datetime, timezone, timedelta
import os
from ultralytics import YOLO

RTSP_URL = "rtsp://192.168.1.58:1935/"
ratio = 0.5
imgsz = 960
CONF = 0.5
OUTPUT_DIR = "detect_motor"
PAD = 20
last_global_trigger_time = -1e18
cooldown_time = 1
camera = 1

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("Checking GPU...")
print("CUDA Available:", torch.cuda.is_available())
print("GPU Count:", torch.cuda.device_count())

model = YOLO(r"model\motorcycle_model.pt")
class_list = model.names
# print("Class list:", class_list)

cap = open_camera(RTSP_URL)
if not cap.isOpened():
    raise RuntimeError("Failed to open video source")

last_trigger_time = {}
crossed_status = {}
prev_cy = {}

print("Start processing video...")



while True:
    ret, frame = cap.read()
    if not ret:
        print("[WARN] ดึงภาพไม่ได้... จะลองเปิดกล้องใหม่")
        cap.release()
        cap = open_camera(RTSP_URL)
        continue

    height, width, _ = frame.shape
    center_y = int(height * (1 - 0.3))
    cv2.line(frame, (0, center_y), (width, center_y), (0, 255, 255), 1)
    x1, y1 = 0, center_y
    
    # โหลดโมเดล YOLO11
    results = model.track(
        frame,
        persist=True,
        tracker="bytetrack.yaml",
        device="0",
        verbose=False,
        imgsz=imgsz,
        classes=[3],
        conf=CONF,
    )

    if results and results[0].boxes is not None and len(results[0].boxes) > 0:
        boxes = results[0].boxes.xyxy.cpu().numpy()
        class_indices = results[0].boxes.cls.int().cpu().tolist()
        confidences = results[0].boxes.conf.cpu().tolist()
        track_ids = (
            results[0].boxes.id.cpu().tolist()
            if results[0].boxes.id is not None
            else [None] * len(boxes)
        )

        for (x1f, y1f, x2f, y2f), track_id, class_idx, conf in zip(
            boxes, track_ids, class_indices, confidences
        ):
            x1, y1, x2, y2 = map(int, [x1f, y1f, x2f, y2f])
            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2

            class_name = class_list.get(class_idx, str(class_idx))
            current_time = time.time()

            # เก็บ cy ก่อนหน้าสำหรับคำนวณทิศทาง
            prev_val = prev_cy.get(track_id, None)
            prev_cy[track_id] = cy

            if center_y - 30 <= y2 <= center_y + 10:
                # ดีเลย์จับรถซ้ำ
                if (current_time - last_global_trigger_time) > cooldown_time:
                    last_global_trigger_time = current_time
                    crossed_status[track_id] = True

                    # 1) ระบุทิศทางเข้า/ออก
                    direction = "IN"
                    if prev_val is not None:
                        if prev_val < center_y <= cy:
                            direction = "OUT"
                        elif prev_val > center_y >= cy:
                            direction = "IN"

                    # 2) ครอปเฉพาะป้าย + padding
                    crop = safe_crop(frame, x1, y1, x2, y2, pad=PAD)
                    if crop is not None:
                        ts = int(current_time)
                        fname = f"Cam_{camera}_Dir_{direction}_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.jpg"
                        save_path = os.path.join(OUTPUT_DIR, fname)
                        cv2.imwrite(save_path, crop)
                        print(
                            f"[TRIGGER] ID:{track_id} Class:{class_name} Dir:{direction} Time::{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}_Cam_{camera}"
                        )

            color = (0, 255, 0) if crossed_status.get(track_id, False) else (0, 0, 255)

            cv2.circle(frame, (cx, cy), 4, (255, 255, 255), -1)
            cv2.putText(
                frame,
                f"ID:{track_id} {class_name} {conf:.2f}",
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                2,
            )
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

    # แสดงผลภาพหลัก
    ratio = 0.3
    frame_display = cv2.resize(frame, (0, 0), fx=ratio, fy=ratio)
    cv2.imshow("YOLO License Plate Tracking", frame_display)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        print("q pressed - exit program")
        break

cap.release()
cv2.destroyAllWindows()
