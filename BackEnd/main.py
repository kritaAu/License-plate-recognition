from ultralytics import YOLO
import cv2
import numpy as np


from sort.sort import*
from util import get_car ,read_license_plate,write_csv

results = {}

mot_tracker = Sort()

motor_model = YOLO('model/motorcycle_model.pt')
license_plate_detector = YOLO('model/lpr_model.pt')

cap = cv2.VideoCapture("video/-_Clipchamp.mp4")

vehicles = [3,2]

#read frame
frame_nmr = -1
ret = True
while ret:
    frame_nmr +=1
    ret,frame = cap.read()
    if ret:
        results[frame_nmr] = {}
        #detect vehicles
        detections = motor_model(frame, imgsz=640, device="0")[0]
        detections_=[]
        for detection in detections.boxes.data.tolist():
            x1,y1,x2,y2,score,class_id = detection
            if int(class_id) in vehicles:
                detections_.append([x1,y1,x2,y2,score])
        

        if len(detections_) == 0:
            print(f"[Frame {frame_nmr}]  ไม่มีรถในเฟรมนี้")
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

