import cv2                
import numpy as np         
import time     
from datetime import datetime           
from ultralytics import YOLO
from util3 import *

motor_model = YOLO("model/motorcycle_model.pt")
plate_model = YOLO("model/lpr_model.pt")

vehicles = {3}
TRIGGER_COOLDOWN_SECONDS = 2.0
state = {}
cooldown = {}

plate_buffer = {}
BUFFER_SIZE = 5

cap = cv2.VideoCapture('video/-_Clipchamp.mp4')

if not cap.isOpened():
    raise RuntimeError("Failed to open video source")


ret, first = cap.read()
if not ret:
    raise RuntimeError("Failed to read first frame")

ENTRY_ZONE = make_entry_zone(first.shape)

cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

while True:
    ret, frame = cap.read()
    if not ret:
        print("End of video or read failure")
        break

    # วาดโซนลงบนภาพให้เราเห็น
    draw_zone(frame, ENTRY_ZONE, color=(0, 0, 255), thickness=1, fill_alpha=0.15)

    tracks = motor_model.track(frame, imgsz=640, device=0, persist=True, classes=[3], verbose=False)
    

    if not tracks or tracks[0].boxes is None or tracks[0].boxes.cls.numel() == 0:
        # แสดงภาพเฉย ๆ (resize ให้พอดีจอแสดง)
        display = cv2.resize(frame, (640, int(640 * frame.shape[0] / frame.shape[1])))
        # cv2.imshow("Line-Trigger Demo", display)
        key = cv2.waitKey(1) & 0xFF
        if key == 27 or key == ord('q'):  # กด ESC หรือ Q เพื่อออก
            break
        continue

    r = tracks[0]                 # ผลของภาพนี้อยู่ใน index 0
    boxes = r.boxes               # กล่องทั้งหมดที่ตรวจเจอ

    # เปลี่ยนเป็น numpy เพื่อใช้งานง่าย
    xyxy = boxes.xyxy.cpu().numpy()            # พิกัดกล่องแต่ละอัน: [x1,y1,x2,y2]
    conf = boxes.conf.cpu().numpy()            # ความมั่นใจของแต่ละกล่อง (0..1)
    cls  = boxes.cls.cpu().numpy().astype(int) # คลาส id ของแต่ละกล่อง
    ids  = (boxes.id.cpu().numpy().astype(int) # หมายเลขติดตาม (track_id) ของ YOLO
            if boxes.id is not None else np.full(cls.shape, -1, dtype=int))

    # เก็บเวลาปัจจุบันไว้ใช้เช็ค cooldown
    now = time.time()

    for (x1b, y1b, x2b, y2b), s, c, tid in zip(xyxy, conf, cls, ids):
        # ข้ามถ้าไม่ใช่คลาสที่สนใจ หรือไม่มี track_id
        if c not in vehicles or tid == -1:
            continue

        # วาดกรอบรถ + แสดง track_id และความมั่นใจ (เพื่อดูผล)
        cv2.rectangle(frame, (int(x1b), int(y1b)), (int(x2b), int(y2b)), (0, 255, 0), 2)
        cv2.putText(frame, f'ID:{tid} {s:.2f}', (int(x1b), int(y1b) - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        # คำนวณ "จุดกึ่งกลาง" ของรถคันนี้ (ใช้ตรวจว่าเข้าโซนหรือยัง)
        cx, cy = int((x1b + x2b) / 2), int((y1b + y2b) / 2)
        cv2.circle(frame, (cx, cy), 3, (255, 255, 255), -1)  # วาดจุดกึ่งกลางให้เห็น

        # เช็คว่าจุดกึ่งกลางอยู่ "ในโซน" ไหม
        inside = cv2.pointPolygonTest(ENTRY_ZONE, (cx, cy), False) >= 0

        # ถ้ารถคันนี้ยังไม่มีสถานะเลย ให้ตั้งต้นเป็น "SEEN" (ยังไม่เข้าโซน)
        if tid not in state:
            state[tid] = {"phase": "SEEN", "t0": 0.0}

        # อ่านสถานะปัจจุบัน
        phase = state[tid]["phase"]

        # เช็ค cooldown: เวลาตั้งแต่ครั้งล่าสุดที่ trigger ≥ TRIGGER_COOLDOWN_SECONDS หรือยัง
        ok_cooldown = (now - cooldown.get(tid, 0.0)) >= TRIGGER_COOLDOWN_SECONDS

        if phase == "SEEN":
            # ถ้าตอนนี้จุดกึ่งกลางเข้ามาในโซน และพ้นช่วง cooldown แล้ว
            if inside and ok_cooldown:
                # เปลี่ยนสถานะเป็น "IN_ZONE" (เริ่มสนใจเก็บป้าย)
                state[tid] = {"phase": "IN_ZONE", "t0": now}
                # สร้างบัฟเฟอร์เก็บภาพป้ายสำหรับคันนี้
                plate_buffer[tid] = {"frames": [], "last_time": now}
                # ตั้งเวลา cooldown ล่าสุด = ตอนนี้
                cooldown[tid] = now

                # วาดตัวหนังสือบนภาพบอกว่า "TRIGGER" เพื่อให้เรารู้ว่าคันนี้เริ่มถูกติดตามป้ายแล้ว
                cv2.putText(frame, f"TRIGGER ID:{tid}", (int(x1b), int(y1b) - 28),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 200, 255), 2)
                print(f"[TRIGGER] tid={tid} t={now:.2f}")

        # -------- PHASE B: กำลังอยู่ในโซน (IN_ZONE) --------
        elif phase == "IN_ZONE":
            if inside:
                # ยังอยู่ในโซน → พยายามหาป้ายทุกเฟรม แล้วเก็บไว้ใน buffer
                car_bbox = [int(x1b), int(y1b), int(x2b), int(y2b)]
                plate_bbox, plate_conf = detect_best_plate_for_car(frame, car_bbox, plate_model)

                if plate_bbox is not None:
                    # ครอป และเตรียมภาพป้ายให้พร้อม OCR
                    crop = preprocess_plate_crop(frame, plate_bbox)
                    if crop is not None:
                        # เก็บไว้ใน buffer ของคันนี้
                        plate_buffer[tid]["frames"].append(crop)
                        # ถ้าเกินจำนวนที่ตั้งไว้ ให้ตัดของเก่าทิ้ง (คงไว้แค่ล่าสุด)
                        if len(plate_buffer[tid]["frames"]) > BUFFER_SIZE:
                            plate_buffer[tid]["frames"].pop(0)
                            
            else:
                # รถ "ออกนอกโซน" แล้ว → ถึงเวลาสรุปผลทะเบียนจาก buffer
                final_text = None   # จะเก็บทะเบียนคำสุดท้าย
                frames_cnt = 0      # จำนวนเฟรมที่เราใช้สรุป

                # ถ้ามีภาพป้ายสะสมอยู่
                if tid in plate_buffer and plate_buffer[tid]["frames"]:
                    texts = []  # จะเก็บข้อความทะเบียนที่อ่านได้จากแต่ละเฟรม
                    for img in plate_buffer[tid]["frames"]:
                        t, _ = read_license_plate(img)  # เรียก OCR
                        if t:
                            texts.append(t)
                    # เลือกคำที่ปรากฏบ่อยที่สุด (majority vote)
                    if texts:
                        final_text = max(set(texts), key=texts.count)
                    frames_cnt = len(plate_buffer[tid]["frames"])

                # Fallback: ถ้าบัฟเฟอร์ว่าง/ยังอ่านไม่ได้ ลองอ่าน "อีกครั้ง" จากเฟรมนี้แบบ one-shot
                if final_text is None:
                    car_bbox = [int(x1b), int(y1b), int(x2b), int(y2b)]
                    plate_bbox, plate_conf = detect_best_plate_for_car(frame, car_bbox, plate_model)
                    if plate_bbox is not None:
                        plate_th = preprocess_plate_crop(frame, plate_bbox)
                        t, _ = read_license_plate(plate_th)
                        if t:
                            final_text = t
                            # วาดกรอบป้ายให้เห็นบนภาพ (เสริม)
                            x1p, y1p, x2p, y2p = plate_bbox
                            cv2.rectangle(frame, (x1p, y1p), (x2p, y2p), (255, 200, 0), 2)
                            cv2.putText(frame, t, (x1p, max(0, y1p - 8)),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 200, 0), 2)

                # ถ้าได้ทะเบียนสุดท้ายแล้ว → "บันทึก"
                if final_text is not None:
                    payload = {
                        "track_id": int(tid),
                        "plate_text": final_text,
                        "frames_count": int(frames_cnt),
                        "ts": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
                    save_to_db(payload)
                    print(f"[FINAL] tid={tid} plate={final_text} frames={frames_cnt} ts={datetime.now().strftime("%Y-%m-%d %H:%M:%S")}")

                # ล้างบัฟเฟอร์ของคันนี้ทิ้ง (เพราะจบการติดตามในโซนแล้ว)
                if tid in plate_buffer:
                    del plate_buffer[tid]
                # กลับสถานะเป็น "SEEN" รอรอบใหม่
                state[tid] = {"phase": "SEEN", "t0": 0.0}

    # display = cv2.resize(frame, (640, int(640 * frame.shape[0] / frame.shape[1])))
    # cv2.imshow("Line-Trigger Demo", display)

    # ตรวจการกดแป้นพิมพ์:
    # - 27 = ESC (ออกจากโปรแกรม)
    # - 'q' = กดตัว Q (ก็ออก)
    key = cv2.waitKey(1) & 0xFF
    if key == 27 or key == ord('q'):
        break