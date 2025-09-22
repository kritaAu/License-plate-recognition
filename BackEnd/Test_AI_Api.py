import base64
from openai import OpenAI

client = OpenAI()

# Function to encode the image
def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


# Path to your image
image_path = r"C:\Users\ktp\Desktop\Train\cropped_plates\plate_3.0_UNKNOWN_1757434292.jpg"

# Getting the Base64 string
base64_image = encode_image(image_path)


response = client.responses.create(
    model="gpt-4o",
    input=[
        {
            "role": "system",
            "content": (
                """
                คุณคือระบบ OCR สำหรับอ่านป้ายทะเบียนไทยจากภาพครอปของป้ายทะเบียนรถจักรยานยนต์เท่านั้น

                **ข้อมูลในป้ายไทยมี 3 บรรทัด (ถ้ามี):**
                1. บรรทัดบน (plate_top)  
                - มีอักษรไทย 1-2 ตัว ถ้ามีมากกว่าสองตัวตัวข้างหน้าจะเป็นตัวเลขเสมอ**ตามด้วยตัวเลข 1-4 หลัก**  
                - ตัวอย่างเช่น: "กข123", "1กก1234","2กฟ2456","23กง1256"
                - อักขระที่อาจสับสน:
                    - ฐ ↔ ร
                    - 0 ↔ O ↔ อ
                    - 1 ↔ I ↔ l
                2. บรรทัดกลาง (province)  
                - เป็นชื่อจังหวัดในประเทศไทย เช่น "กรุงเทพมหานคร", "เชียงใหม่", "ขอนแก่น"
                - ต้องเป็นชื่อจังหวัดจริงเท่านั้น
                3. บรรทัดล่าง (plate_bottom)  
                - ใช้สำหรับมอเตอร์ไซค์บางประเภท เป็น **ตัวเลขล้วน 1-4 หลัก**
                

                **กติกาสำคัญ:**
                - ถ้าไม่มั่นใจในบางอักขระ ให้แทนด้วย ? ในตำแหน่งนั้น เช่น "ก?123"
                - ห้ามเดา ห้ามเติมจังหวัดถ้าไม่เห็นชัดเจน
                - ให้ส่งข้อมูลเป็น JSON เท่านั้น ไม่ส่งข้อความอื่น

                "Output JSON format:\n"
                "{\n"
                "  \"plate\": \"บรรทัดบนสุด+บรรทัดล่างสุด\",\n"
                "  \"province\": \"บรรทัดกลาง\"\n"
                "}"
                """
                
            )
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": "อ่านป้ายทะเบียนแล้ว format json"
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