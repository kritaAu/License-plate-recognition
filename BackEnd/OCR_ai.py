import base64
import json
from openai import OpenAI
import os
import re
from datetime import datetime, timezone, timedelta

client = OpenAI()

# Function to encode the image
def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")

def dt_to_iso(dt_str: str) -> str:
    # จาก "2025-11-03_14-30-00"
    dt = datetime.strptime(dt_str, "%Y-%m-%d_%H-%M-%S")
    # สมมุติเป็น UTC+7
    dt = dt.replace(tzinfo=timezone(timedelta(hours=7)))
    # คืนเป็น ISO 8601 ที่ถูกต้อง
    return dt.isoformat()   # 👉 "2025-11-03T14:30:00+07:00"

def read_plate(image_path: str):

    filename = os.path.basename(image_path)
    match = re.search(r"^Dir_(.*?)_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})", filename)
    if match:
        dir = match.group(1)   # IN
        dt   = match.group(2)   # 2025-10-04_01-19-55
        iso_dt = dt_to_iso(dt)
        print("Code:", dir)
        print("Datetime:", dt)
        print("DatetimeISO:",iso_dt)
    else:
        print("ไม่ตรง pattern")
    base64_image = encode_image(image_path)

    response = client.responses.create(
        model="gpt-4o",
        input=[
            {
                "role": "system",
                "content": (
                    """
                    คุณคือ OCR สำหรับภาพ “ป้ายทะเบียนมอเตอร์ไซค์ของไทย” (ครอปเฉพาะป้าย)
                    รูปแบบบรรทัด:
                    1) plate_top: อักษรไทย 1-2 ตัว + ตัวเลข 1-4 หลัก
                    - ถ้าอักษรมากกว่า 2 ตัว ตัวแรกจะเป็นตัวเลขเสมอ
                    - ตัวอย่าง: กข123, 1กก1234, 2กฟ2456, 23กง1256
                    - อักขระสับสนที่พบบ่อย: ฐ↔ร, 0↔O↔อ, 1↔I↔l
                    2) province: ชื่อจังหวัดจริงของไทยเท่านั้น (เช่น กรุงเทพมหานคร, เชียงใหม่, ขอนแก่น)
                    3) plate_bottom: ตัวเลขล้วน 1-4 หลัก (มีเฉพาะบางป้าย)

                    กติกา:
                    - ไม่มั่นใจตัวไหน ใส่ “?” แทนตำแหน่งนั้น เช่น ก?123
                    - ห้ามเดาหรือเติมจังหวัดถ้าไม่เห็นชัด
                    - ออกผลเป็น JSON เท่านั้น
                    - ค่า plate = plate_top ต่อด้วย plate_bottom (ถ้าไม่มีบรรทัดล่าง ให้ใช้เฉพาะ plate_top)
                    -ถ้าไม่มีป้ายทะเบียนหรือภาพอะไรไม่รู้ให้ทุกค่าเป็น None แล้วใส่ตรง plate เป็น ไม่มีป้ายทะเบียน
                    Output JSON:
                    {
                    "plate": "<plate_top(+plate_bottomถ้ามี)>",
                    "province": "<provinceหรือเว้นว่างถ้าไม่เห็น>",
                    "time":"<datetime จากไฟล์>"
                    "direction":"<IN or OUT>"
                    }
                    """
                    
                )
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": f"อ่านป้ายทะเบียนแล้วออก JSON โดยให้ datetime = \"{iso_dt}\" และ direction = \"{dir}\""
                    },
                    {
                        "type": "input_image",
                        "image_url": f"data:image/jpeg;base64,{base64_image}","detail": "low"
                    }
                ]
            }
        ],
    )
    try:
        txt = response.output_text.strip()
        txt = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", txt, flags=re.IGNORECASE|re.DOTALL)
        return json.loads(txt)
    except Exception:
        return {"raw_text": response.output_text}
