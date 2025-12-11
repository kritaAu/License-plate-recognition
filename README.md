# 🚗 License Plate Recognition System

## 🌟 Overview

This is a comprehensive, full-stack project implementing an **Automatic License Plate Recognition (ALPR)** system.

This project demonstrates strong capabilities in modern software architecture, high-performance machine learning implementation, and data visualization—key skills for a Computer Science student and Data Analyst.


The system is modularly composed of two main services:
1.  **Backend (Python/FastAPI):** Handles the core ALPR logic using machine learning models (YOLO, PyTorch) and provides an API for data processing and storage (Supabase).
2.  **Frontend (React/Vite):** A modern, responsive web dashboard for users to upload images, view results, and visualize data related to the recognized plates.

---

## 🚀 Key Features

* **High-Performance ALPR:** Utilizes advanced computer vision models (YOLO family) for fast and accurate detection.
* **Modern API:** Built with FastAPI for speed and easy integration.
* **Data Visualization:** Incorporates Recharts for analytical display of recognition data.
* **Database Integration:** Uses Supabase for scalable data storage and user authentication.

---

## 🛠️ Tech Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Backend** | Python, FastAPI | Core API, ML Inference, Database Interface |
| **Frontend** | React, Vite | User Interface, Client-Side Routing |
| **Computer Vision** | Ultralytics (YOLO), PyTorch, OpenCV | License Plate Detection and OCR |
| **Styling** | Tailwind CSS, Bootstrap | UI Design and Responsiveness |
| **Database/Auth** | Supabase | Data Storage (PostgreSQL) and Authentication |
| **Visualization** | Recharts | Charting and Graphing |

---

## 💻 Setup and Installation Guide

You must set up both the Backend and the Frontend separately.

### A. Backend Setup (`./BackEnd` folder)

The backend handles the core ALPR processing and API services.

#### 1. Prerequisites

* Python (3.8+)
* **Optional (for GPU acceleration):** NVIDIA CUDA Toolkit. Download from [https://developer.nvidia.com/cuda-downloads](https://developer.nvidia.com/cuda-downloads)

#### 2. Environment & Dependencies

Navigate to the backend directory and install all required Python libraries.

```bash
# Navigate to the backend directory
cd BackEnd

# Install Core Vision, ML, and API dependencies
pip install ultralytics opencv-python filterpy yolox
pip install "fastapi[standard]" supabase bcrypt==4.0.1 passlib[bcrypt] python-dotenv openai rapidfuzz


GPU Note: If you installed CUDA, install PyTorch with the specific CUDA index URL. Please verify the CUDA version.
# Example for CUDA 12.1 (cu121). 
pip3 install torch torchvision --index-url [https://download.pytorch.org/whl/cu129](https://download.pytorch.org/whl/cu129)


<h4 style="color:#007ACC;">3. Configuration</h4>
Create a .env file in the ./BackEnd directory to store your credentials:

<h4 style="color:#007ACC;">4. Running the Backend</h4>
Start the FastAPI server on port 8000:

# Development run with auto-reload
python -m uvicorn main_api:app --reload --port 8000

# Production run or Alternative/Batch run
# uvicorn main_api:app --host 0.0.0.0 --port 8000 --log-level warning
# python -m uvicorn batch_process:app --reload --host 0.0.0.0 --port 8001

B. Frontend Setup (./FrontEnd/LicensePlate-Web folder)
The frontend provides the interactive user dashboard.

1. Prerequisites
Node.js (LTS recommended)

2. Dependencies
Navigate to the frontend directory and install the Node modules:

# Navigate to the frontend web directory
cd FrontEnd/LicensePlate-Web

# 1. Install core dependencies
npm install

# 2. Install styling, routing, and data visualization
npm i bootstrap@5.3.8
npm install tailwindcss @tailwindcss/vite
npm i react-router-dom
npm i recharts


ผมเข้าใจแล้วครับ! คุณต้องการไฟล์ README.md หลักที่ใช้แสดงบนหน้าแรกของ GitHub Repository ให้ดู สวยงาม (polished), ครบถ้วนสมบูรณ์ (complete), และ น่าประทับใจ ในฐานะโปรเจกต์ Full-Stack สำหรับนักศึกษา Computer Science และ Data Analyst.

ผมได้นำเอาเนื้อหาทั้งหมดที่คุณเคยให้มา, ปรับปรุงการจัดรูปแบบ, จัดเรียงหัวข้อให้เป็นตรรกะ, และแก้ไขปัญหาไวยากรณ์ Markdown ที่เคยมี (เช่น การจัดเรียงหัวข้อที่ผิดพลาด และการใส่โค้ดบล็อก) รวมถึงการใช้ HTML Tag เพื่อเน้นสีหัวข้อตามที่คุณต้องการก่อนหน้านี้ครับ

✨ โค้ด README.md ฉบับสมบูรณ์สำหรับ GitHub
นี่คือโค้ด Markdown ที่พร้อมนำไปวางในไฟล์ README.md หลักของคุณได้เลยครับ:

Markdown
# 🚗 License Plate Recognition System

## 🌟 Overview

This is a comprehensive, full-stack project implementing an **Automatic License Plate Recognition (ALPR)** system.

This project demonstrates strong capabilities in modern software architecture, high-performance machine learning implementation, and data visualization—key skills for a Computer Science student and Data Analyst.


The system is modularly composed of two main services:
1.  **Backend (Python/FastAPI):** Handles the core ALPR logic using machine learning models (YOLO, PyTorch) and provides an API for data processing and storage (Supabase).
2.  **Frontend (React/Vite):** A modern, responsive web dashboard for users to upload images, view results, and visualize data related to the recognized plates.

---

## 🚀 Key Features

* **High-Performance ALPR:** Utilizes advanced computer vision models (YOLO family) for fast and accurate detection.
* **Modern API:** Built with FastAPI for speed and easy integration.
* **Data Visualization:** Incorporates Recharts for analytical display of recognition data.
* **Database Integration:** Uses Supabase for scalable data storage and user authentication.

---

## 🛠️ Tech Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Backend** | Python, FastAPI | Core API, ML Inference, Database Interface |
| **Frontend** | React, Vite | User Interface, Client-Side Routing |
| **Computer Vision** | Ultralytics (YOLO), PyTorch, OpenCV | License Plate Detection and OCR |
| **Styling** | Tailwind CSS, Bootstrap | UI Design and Responsiveness |
| **Database/Auth** | Supabase | Data Storage (PostgreSQL) and Authentication |
| **Visualization** | Recharts | Charting and Graphing |

---

## 💻 Setup and Installation Guide

You must set up both the Backend and the Frontend separately.

### A. Backend Setup (`./BackEnd` folder)

The backend handles the core ALPR processing and API services.

#### 1. Prerequisites

* Python (3.8+)
* **Optional (for GPU acceleration):** NVIDIA CUDA Toolkit. Download from [https://developer.nvidia.com/cuda-downloads](https://developer.nvidia.com/cuda-downloads)

#### 2. Environment & Dependencies

Navigate to the backend directory and install all required Python libraries.

```bash
# Navigate to the backend directory
cd BackEnd

# Install Core Vision, ML, and API dependencies
pip install ultralytics opencv-python filterpy yolox
pip install "fastapi[standard]" supabase bcrypt==4.0.1 passlib[bcrypt] python-dotenv openai rapidfuzz
GPU Note: If you installed CUDA, install PyTorch with the specific CUDA index URL. Please verify the CUDA version.

Bash
# Example for CUDA 12.1 (cu121). 
pip3 install torch torchvision --index-url [https://download.pytorch.org/whl/cu129](https://download.pytorch.org/whl/cu129)
<h4 style="color:#007ACC;">3. Configuration</h4>

Create a .env file in the ./BackEnd directory to store your credentials:

ข้อมูลโค้ด
# Supabase Configuration
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_KEY=YOUR_SUPABASE_ANON_KEY

# Other API keys (e.g., OpenAI)
OPENAI_API_KEY=YOUR_OPENAI_KEY
<h4 style="color:#007ACC;">4. Running the Backend</h4>

Start the FastAPI server on port 8000:

Bash
# Development run with auto-reload
python -m uvicorn main_api:app --reload --port 8000

# Production run or Alternative/Batch run
# uvicorn main_api:app --host 0.0.0.0 --port 8000 --log-level warning
# python -m uvicorn batch_process:app --reload --host 0.0.0.0 --port 8001
B. Frontend Setup (./FrontEnd/LicensePlate-Web folder)
The frontend provides the interactive user dashboard.

1. Prerequisites
Node.js (LTS recommended)

2. Dependencies
Navigate to the frontend directory and install the Node modules:

Bash
# Navigate to the frontend web directory
cd FrontEnd/LicensePlate-Web

# 1. Install core dependencies
npm install

# 2. Install styling, routing, and data visualization
npm i bootstrap@5.3.8
npm install tailwindcss @tailwindcss/vite
npm i react-router-dom
npm i recharts

# 3. Running the Frontend
Start the development server:
npm run dev