from ultralytics import YOLO
import cv2
import numpy as np


# from sort.sort import*
from util import get_car ,read_license_plate,write_csv

lane_points = []
# Mouse callback function เพื่อรับพิกัดและคำนวณ slope
def mouse_callback(event, x, y, flags, param):
    global lane_points
    if event == cv2.EVENT_LBUTTONDOWN:
        orig_x = int(x / ratio)
        orig_y = int(y / ratio)
        print(f"Mouse clicked at: X={orig_x}, Y={orig_y}")
        lane_points.append((orig_x, orig_y))

        if len(lane_points) == 2:
            # คำนวณ slope และ intercept จากสองจุด
            x1, y1 = lane_points[0]
            x2, y2 = lane_points[1]

            if y2 != y1:  # ป้องกันการหารด้วยศูนย์
                slope = (x2 - x1) / (y2 - y1)
                intercept = x2 - slope * y2
                print(f"\nLane divider calculated:")
                print(f"slope = {slope:.3f}")
                print(f"intercept = {intercept:.1f}")
                print(f"Equation: x = {slope:.3f} * y + {intercept:.1f}")

            lane_points.clear()  # รีเซ็ตสำหรับการคำนวณครั้งถัดไป

def get_lane_divider_x(y):
    """Calculate x coordinate of lane divider at given y coordinate"""
    return int(lane_divider_slope * y + lane_divider_intercept)

def draw_sloped_lane_divider(frame, y_start, y_end):
    """Draw sloped lane divider based on curb"""
    x_start = get_lane_divider_x(y_start)
    x_end = get_lane_divider_x(y_end)
    cv2.line(frame, (x_start, y_start), (x_end, y_end), (255, 255, 255), 3)


# ตั้งค่าตัวแปรต่างๆ
ratio = 0.5  # สเกลของรูปภาพที่แสดง (กำหนดเอง)
line_y_in = 1300      # ค่าแกน y (ฝั่งขาเข้า, ขวา) (กำหนดเอง)
line_y_out = line_y_in   # ค่าแกน y (ฝั่งขาออก, ซ้าย) (กำหนดเอง)
lane_divider_slope = 0.376    # คำนวนจากสูตรเส้นตรง
lane_divider_intercept = 1485.7  # คำนวนจากสูตรเส้นตรง
divider_x_at_out = get_lane_divider_x(line_y_out)
divider_x_at_in = get_lane_divider_x(line_y_in)
name = "YOLO car count"
results = {}

# mot_tracker = Sort()

motor_model = YOLO('model/motorcycle_model.pt')
license_plate_detector = YOLO('model/lpr_model.pt')

cap = cv2.VideoCapture("video/-_Clipchamp.mp4")

vehicles = [3]

#read frame
frame_nmr = -1

while cap.isOpened():
    ret,frame = cap.read()
    results[frame_nmr] = {}
    if not ret:
        break

    #detect vehicles
    tracks = motor_model.track(frame, imgsz=640, device="0",persist=True,classes= [3],verbose = False)
    detections_=[]
    for detection in detections.boxes.data.tolist():
        x1,y1,x2,y2,score,class_id = detection
        if int(class_id) in vehicles:
            detections_.append([x1,y1,x2,y2,score])
    

    if len(detections_) == 0:
        print(f"[Frame {frame_nmr}]  ไม่มีรถในเฟรมนี้")
        frame_nmr += 1
        continue
    #track vehicles
    
    dets = np.array(detections_, dtype=float)
    if dets.size == 0:
        dets = np.empty((0, 5), dtype=float)  
    track_ids = mot_tracker.update(dets)

    for track in track_ids:
        x1, y1, x2, y2, track_id = track
        x1, y1, x2, y2, track_id = int(x1), int(y1), int(x2), int(y2), int(track_id)

        # วาดกรอบรอบรถ
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

        # ใส่ Track ID
        cv2.putText(frame,
                    f'ID: {track_id}',
                    (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2)
    #detect license plate
    license_plates = license_plate_detector(frame, imgsz=640, device="0")[0]
    for license_plate in license_plates.boxes.data.tolist():
        x1,y1,x2,y2,score,class_id = license_plate

        #assign licen plate
        xcar1, ycar1, xcar2 ,ycar2,car_id = get_car(license_plate,track_ids)

        if car_id != -1:

            #crop license plate
            license_plate_crop = frame[int(y1):int(y2),int(x1):int(x2),:]

            #process license plate
            license_plate_crop_gray = cv2.cvtColor(license_plate_crop,cv2.COLOR_BGR2GRAY)
            _, license_plate_crop_thresh = cv2.threshold(license_plate_crop_gray,0,255,cv2.THRESH_BINARY_INV+cv2.THRESH_OTSU)

            #read license plate
            license_plate_text,license_plate_text_score = read_license_plate(license_plate_crop_thresh)

            if license_plate_text is not None:
                results[frame_nmr][car_id] = {'car':{'bbox':[xcar1, ycar1, xcar2 ,ycar2]},'license_plate':{'bbox':[x1,y1,x2,y2],
                                                                                'text':license_plate_text,
                                                                                    'bbox_score':score,
                                                                                    'text_score':license_plate_text_score}}
    
    
    display_frame = cv2.resize(frame, (640, 960))
    cv2.imshow("RTSP Stream", display_frame)

    # กด q เพื่อออก
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
#write restults
write_csv(results,'./test.csv')

