
import cv2
import numpy as np   


def draw_zone(frame, polygon, color=(0, 0, 255), thickness=1, fill_alpha=0.15):
    
    overlay = frame.copy()  # ทำสำเนาไว้สำหรับผสมโปร่งใส
    # วาดเส้นขอบของโซน
    cv2.polylines(overlay, [polygon], isClosed=True, color=color, thickness=thickness)
    # ถ้าอยากระบายสีพื้นของโซนให้เห็นชัด ๆ
    if fill_alpha > 0:
        cv2.fillPoly(overlay, [polygon], color)
    # ผสมภาพ overlay กลับเข้า frame ตามอัตราส่วนโปร่งใส
    cv2.addWeighted(overlay, fill_alpha, frame, 1 - fill_alpha, 0, frame)


def make_entry_zone(frame_shape):
    """
    สร้างโซนสี่เหลี่ยมโดยอัตโนมัติจากขนาดภาพ:
    - กว้างประมาณ 90% ของเฟรม
    - วางไว้ช่วงล่างของภาพ (60% ถึง 90% ของความสูง)
    """
    h, w = frame_shape[:2]     # h=ความสูง, w=ความกว้างภาพ
    y1 = int(h * 0.55)         # เส้นบนของโซน (ต่ำลงมาประมาณ 60%)
    y2 = int(h * 0.90)         # เส้นล่างของโซน (ใกล้ขอบล่าง 90%)
    x1 = int(w * 0.02)         # ขอบซ้าย (เหลือ margin 5%)
    x2 = int(w * 0.98)         # ขอบขวา (เหลือ margin 5%)
    # คืนรูปสี่เหลี่ยมในแบบ จุดวนตามเข็ม (หรือทวน) 4 จุด
    return np.array([(x1, y1), (x2, y1), (x2, y2), (x1, y2)], np.int32)


def detect_best_plate_for_car(frame, car_bbox, plate_model):
    
    # เรียกโมเดลป้าย: คืนผลหลายอันใน res (เราใช้ตัวแรก [0] เพราะเป็นผลของภาพนี้หนึ่งภาพ)
    res = plate_model(frame, imgsz=960, device=0, verbose=False)[0]
    # ถ้าไม่เจอกรอบอะไรเลย
    if res.boxes is None or res.boxes.data.numel() == 0:
        return None, None

    cx1, cy1, cx2, cy2 = car_bbox  # แกะกรอบรถ
    best_iou, best = 0.0, None     # ใช้เก็บป้ายที่ดีที่สุด

    # วนทุกกรอบป้ายที่โมเดลหาเจอ: (x1, y1, x2, y2, score, class_id)
    for x1, y1, x2, y2, score, cls_id in res.boxes.data.tolist():
        # คำนวณส่วนซ้อนทับ (intersection) ระหว่างกรอบป้ายกับกรอบรถ
        ix1, iy1 = max(cx1, x1), max(cy1, y1)
        ix2, iy2 = min(cx2, x2), min(cy2, y2)
        iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
        inter = iw * ih

        # พื้นที่รวม (union) = พื้นที่รถ + พื้นที่ป้าย - ส่วนทับกัน
        area_c = (cx2 - cx1) * (cy2 - cy1)
        area_l = (x2 - x1) * (y2 - y1)
        union = max(area_c + area_l - inter, 1e-6)  # ป้องกันหาร 0

        # IoU = inter / union → ค่ายิ่งใกล้ 1 แปลว่าทับมาก
        iou = inter / union

        # เก็บอันที่ดีที่สุด (IoU สูงสุด)
        if iou > best_iou:
            best_iou = iou
            best = ([int(x1), int(y1), int(x2), int(y2)], float(score))

    # ถ้าไม่มีเลย คืน (None, None)
    return best if best else (None, None)

def preprocess_plate_crop(frame, plate_bbox):
    """
    รับกรอบป้าย (plate_bbox) → ครอปเฉพาะส่วนนั้น
    → แปลงเป็นภาพขาวดำ (grayscale)
    → ทำ Threshold แบบ Otsu (ช่วยให้ตัวอักษรกับพื้นตัดกันชัด)
    """
    x1, y1, x2, y2 = plate_bbox
    crop = frame[int(y1):int(y2), int(x1):int(x2)]  # ตัดส่วนป้ายออกมา
    if crop.size == 0:
        return None
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)   # สีเทา
    # OTSU จะเลือกค่าตัดแสงอัตโนมัติให้เหมาะกับภาพ → ได้ภาพขาว-ดำ (ตัวหนังสือเด่นขึ้น)
    _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return th


def read_license_plate(thresh_img):
    """
    ตรงนี้คือ OCR (อ่านตัวหนังสือจากภาพ)
    - ตอนนี้ทำแบบจำลอง (mock) เพื่อเดโมการไหลงาน
    - ถ้าคุณมี OCR จริง (เช่น PaddleOCR ภาษาไทย) ให้มาแก้ฟังก์ชันนี้
    """
    if thresh_img is None:
        return None, 0.0
    # เดโม่: สมมติอ่านได้เป็น "กข123" ด้วยความมั่นใจ 0.92
    return "กข123", 0.92


def save_to_db(payload: dict):
    """
    ปกติจะ INSERT ลงฐานข้อมูล (PostgreSQL/MongoDB ฯลฯ)
    - ตอนนี้พิมพ์ LOG ให้ดูเฉย ๆ
    """
    print("DB-SAVE:", payload)