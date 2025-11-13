import json
from openai import OpenAI
import os
import re
from utils import *
import base64

client = OpenAI()
print("[OCR_ai.py] OpenAI Client (OCR) โหลดสำเร็จ")


def read_plate(img_b64: str):

    try:
        response = client.responses.create(
            model="gpt-4o",
            input=[
                {
                    "role": "system",
                    "content": (
                        """
                        คุณคือ OCR สำหรับภาพ “ป้ายทะเบียนมอเตอร์ไซค์ของไทย” (ครอปเฉพาะป้าย)
                        รูปแบบบรรทัด:
                        1) plate_top:มีได้ 3 ตัวเท่านั้น 
                        - ถ้ามีเลข เลขอยู่หน้าสุด 
                        - สองตัวขวาต้องเป็นอักษรไทย
                        -มีเลขซ้ายสุด → 1กก, 2ขข, 3พร, 9ธน
                        -ไม่มีเลข → กข, กทม, พร, นค
                        - อักขระสับสนที่พบบ่อย: ฐ↔ร, 0↔O↔อ, 1↔I↔l
                        2) province: ชื่อจังหวัดจริงของไทยเท่านั้น (เช่น กรุงเทพมหานคร, เชียงใหม่, ขอนแก่น)
                        3) plate_bottom: ตัวเลขล้วน 1-4 หลัก

                        กติกา:
                        - ไม่มั่นใจตัวไหน ใส่ “?” แทนตำแหน่งนั้น เช่น ก?123
                        - ห้ามเดาหรือเติมจังหวัดถ้าไม่เห็นชัด
                        - ออกผลเป็น JSON เท่านั้น
                        - ค่า plate = plate_top ต่อด้วย plate_bottom (ถ้าไม่มีบรรทัดล่าง ให้ใช้เฉพาะ plate_top)
                        -ถ้าไม่มีป้ายทะเบียนหรือภาพอะไรไม่รู้ให้plate เป็น "ไม่มีป้ายทะเบียน" province เป็น Null
                        Output JSON:
                        {
                        "plate": "<plate_top(+plate_bottom)>",
                        "province": "<provinceหรือเว้นว่างถ้าไม่เห็น>"
                        }
                        """
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": f'อ่านป้ายทะเบียนแล้ว output เป็น format JSON ',
                        },
                        {
                            "type": "input_image",
                            "image_url": f"data:image/jpeg;base64,{img_b64}",
                            "detail": "high",
                        },
                    ],
                },
            ],
        )
        try:
            txt = response.output_text.strip()
            txt = re.sub(
                r"^\s*```(?:json)?\s*|\s*```\s*$",
                "",
                txt,
                flags=re.IGNORECASE | re.DOTALL,
            )
            return json.loads(txt)
        except Exception as e:
            print(f"[ERROR OCR] {e}")
            return {
                "plate": "ไม่มีป้ายทะเบียน",
                "province": None,
            }
    except Exception as e:
        print(f"[ERROR OCR] {e}")
        return {
            "plate": "ไม่มีป้ายทะเบียน",
            "province": None
        }
