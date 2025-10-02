import base64
from openai import OpenAI
import os
import re

client = OpenAI()

# Function to encode the image
def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


# Path to your image
image_path = r"detect_motor\Dir_IN_2025-10-02_01-02-51.jpg"

filename = os.path.basename(image_path)
match = re.search(r"\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}", filename)
file_datetime = match.group(0) if match else ""
# print(file_datetime)
# Getting the Base64 string
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

                Output JSON:
                {
                "plate": "<plate_top(+plate_bottomถ้ามี)>",
                "province": "<provinceหรือเว้นว่างถ้าไม่เห็น>",
                "time":"<datetime จากไฟล์>"
                }
                """
                
            )
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": f"อ่านป้ายทะเบียนแล้วออก JSON โดยให้ time = \"{image_path}\""
                },
                {
                    "type": "input_image",
                    "image_url": f"data:image/jpeg;base64,{base64_image}","detail": "low"
                }
            ]
        }
    ],
)

print(response.output_text)
print("Input tokens:", response.usage.input_tokens)
print("Output tokens:", response.usage.output_tokens)
print("Total tokens:", response.usage.total_tokens)