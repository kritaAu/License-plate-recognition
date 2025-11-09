import json
from openai import OpenAI
import os
import re
from utils import *
import base64

client = OpenAI()
print("[OCR_ai.py] OpenAI Client (OCR) โหลดสำเร็จ")


def read_plate(img_b64: str, iso_dt: str, direction: str, cam_id: int):
    """
    นี่คือฟังก์ชัน OCR (AI ตัวที่ 3) ที่รับข้อมูลมา
    แล้วส่งไปให้ GPT-4o อ่าน
    """

    try:
        response = client.responses.create(
            model="gpt-4o",
            input=[
                {
                    "role": "system",
                    "content": (
                        """
                        คุณคือ OCR สำหรับภาพ “ป้ายทะเบียนมอเตอร์ไซค์ของไทย”...
                        ... (Prompt ของคุณเหมือนเดิม) ...
                        Output JSON:
                        {
                        "plate": "<plate_top(+plate_bottom)>",
                        "province": "<provinceหรือเว้นว่างถ้าไม่เห็น>",
                        "time":"<datetime จากไฟล์>"
                        "direction":"<IN or OUT>"
                        "camera":<number>
                        }
                        """
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": f'อ่านป้ายทะเบียนแล้ว output เป็น JSON โดยให้ datetime = "{iso_dt}" และ direction = "{direction}"และ Camera = "{cam_id}"',
                        },
                        {
                            "type": "input_image",
                            "image_url": f"data:image/jpeg;base64,{img_b64}",
                            "detail": "low",
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
                "time": iso_dt,
                "plate": "ไม่มีป้ายทะเบียน",
                "province": None,
                "direction": direction,
                "camera": cam_id,
            }
    except Exception as e:
        print(f"[ERROR OCR] {e}")
        return {
            "time": iso_dt,
            "plate": "ไม่มีป้ายทะเบียน",
            "province": None,
            "direction": direction,
            "camera": cam_id,
        }
