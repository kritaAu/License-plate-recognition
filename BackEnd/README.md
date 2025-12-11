# Backend API: License Plate Recognition (LPR)

## Overview

This directory contains the Python-based API server responsible for the core functionality of the License Plate Recognition (LPR) system.

**Key responsibilities of this module include:**
* **ML Inference:** Running the computer vision models (YOLO/PyTorch) for license plate detection and OCR.
* **API Exposure:** Providing RESTful endpoints via FastAPI.
* **Data Handling:** Interacting with the Supabase database for data storage and retrieval.

---

## 🛠️ Installation & Setup

### 1. Prerequisites

* Python (3.8+)
* **Optional (สำหรับ GPU Acceleration):** NVIDIA CUDA Toolkit.
    * คุณสามารถดาวน์โหลด CUDA ได้จาก [https://developer.nvidia.com/cuda-downloads](https://developer.nvidia.com/cuda-downloads) (สำหรับ GPU เฉพาะ NVIDIA)

### 2. Environment & Dependencies

ติดตั้งไลบรารีทั้งหมดที่จำเป็นสำหรับ ML/Vision, API Framework, และการจัดการฐานข้อมูล

```bash
# 1. ติดตั้ง Core ML/Vision Libraries
pip install ultralytics opencv-python filterpy yolox

# 2. ติดตั้ง PyTorch (เฉพาะผู้ใช้ GPU)
# หมายเหตุ: ตรวจสอบเวอร์ชัน CUDA ของคุณและเปลี่ยน cu129 เป็นเวอร์ชันที่ถูกต้อง
pip3 install torch torchvision --index-url [https://download.pytorch.org/whl/cu129](https://download.pytorch.org/whl/cu129)

# 3. ติดตั้ง API Framework (FastAPI) และ Database/Auth Libraries
pip install "fastapi[standard]"
pip install supabase
pip install bcrypt==4.0.1
pip install "passlib[bcrypt]"
pip install rapidfuzz

# 4. ติดตั้ง Utilities (สำหรับจัดการ Environment และ OpenAI)
pip install dotenv
pip install openai

# 5. สร้างไฟล์ .env
สร้างไฟล์ .env ในโฟลเดอร์นี้ (./BackEnd) เพื่อเก็บข้อมูลลับ (Credentials) ของ Supabase และ API อื่นๆ

# 6. ใช้ uvicorn เพื่อรัน FastAPI Application
Development Mode 
python -m uvicorn main_api:app --reload --port 8000

Production Mode 
uvicorn main_api:app --host 0.0.0.0 --port 8000 --log-level warning

Alternative Run
python -m uvicorn batch_process:app --reload --host 0.0.0.0 --port 8001

------
Documentation & Reference
FastAPI Official: https://fastapi.tiangolo.com
Supabase Python Docs: https://supabase.com/docs/reference/python/initializing?queryGroups=platform&platform=pip