import cv2
import torch
import time
import os
from ultralytics import YOLO
import numpy as np


ratio = 0.5           
conf_threshold = 0.3 #ปรับได้ลองปรับดูเอาไว้แก้ค่าความมั่นใจ
imgsz = 1280           
cooldown_time = 2    
center_y = 1000         


print("Checking GPU...")
print("CUDA Available:", torch.cuda.is_available())
print("GPU Count:", torch.cuda.device_count())

model = YOLO(r"best(last).pt")
class_list = model.names
print("Class list:", class_list)

model2 = YOLO(r"yolo11n.pt")
class_list2 = model2.names
print("Class list:", class_list2)


cap = cv2.VideoCapture(r"/////") ## หาคลิปมาใส่เทสดู
if not cap.isOpened():
    print("Error: Cannot open video")
    raise SystemExit


print("Start processing video...")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        print("Video error", ret)
        break

    height, width, _ = frame.shape

    # วาดเส้น trigger
    # cv2.line(frame, (0, center_y), (width, center_y), (255, 255, 255), 1)

    results = model.track(
        frame,
        persist=True,
        tracker="bytetrack.yaml",
        device="0",
        verbose=False,
        imgsz=imgsz,
        conf=conf_threshold,
        classes=[0]
    )
    results2 = model2.track(
        frame,
        persist=True,
        tracker="bytetrack.yaml",
        device="0",
        verbose=False,
        imgsz=imgsz,
        conf=conf_threshold,
        classes=[3]
    )

    if results and results[0].boxes is not None and len(results[0].boxes) > 0:
        boxes = results[0].boxes.xyxy.cpu().numpy()
        class_indices = results[0].boxes.cls.int().cpu().tolist()
        confidences = results[0].boxes.conf.cpu().tolist()
        track_ids = results[0].boxes.id.cpu().tolist() if results[0].boxes.id is not None else [None] * len(boxes)

        for box, track_id, class_idx, conf in zip(boxes, track_ids, class_indices, confidences):
            x1, y1, x2, y2 = map(int, box)
            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2
            class_name = class_list[class_idx]

            
            cv2.circle(frame, (cx, cy), 4, (255, 255, 255), -1)
            cv2.putText(
                frame, f"ID:{track_id} {class_name} {conf:.2f}",
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6, (255, 0, 255), 2
            )
            cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 255), 2)

    
    if results2 and results2[0].boxes is not None and len(results2[0].boxes) > 0:
        boxes = results2[0].boxes.xyxy.cpu().numpy()
        class_indices = results2[0].boxes.cls.int().cpu().tolist()
        confidences = results2[0].boxes.conf.cpu().tolist()
        track_ids = results2[0].boxes.id.cpu().tolist() if results2[0].boxes.id is not None else [None] * len(boxes)

        for box, track_id, class_idx, conf in zip(boxes, track_ids, class_indices, confidences):
            x1, y1, x2, y2 = map(int, box)
            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2
            class_name = class_list2[class_idx]

            
            cv2.circle(frame, (cx, cy), 4, (255, 255, 255), -1)
            cv2.putText(
                frame, f"ID:{track_id} {class_name} {conf:.2f}",
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6, (0, 255, 0), 2
            )
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)


    frame_display = cv2.resize(frame, (0, 0), fx=ratio, fy=ratio)
    cv2.imshow("YOLO License Plate Tracking", frame_display)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        print("q pressed - exit program")
        break

cap.release()
cv2.destroyAllWindows()