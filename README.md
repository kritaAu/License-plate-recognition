# License Plate Recognition System 🚗🔍

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com)
[![Ultralytics YOLO](https://img.shields.io/badge/YOLO-Ultralytics-blue)](https://github.com/ultralytics/ultralytics)

A comprehensive smart parking management system that integrates AI (YOLO + GPT-4o OCR) to automatically detect and read motorcycle and car license plates.

---

## 🏗️ System Architecture

This project is divided into 2 main components (click the names for more details):

1. **[BackEnd](./BackEnd/README.md)** (Python / FastAPI / YOLO / Supabase)
   - AI Model execution for Object Detection (YOLO).
   - Image cropping and integration with GPT-4o for OCR to read license plates.
   - Modular API architecture (Auth, Members, Events, Parking, Dashboard).
   - Smart Parking Session Matching Logic (handling entry/exit pairing).
   - Real-time event broadcasting via WebSocket.

2. **[FrontEnd](./FrontEnd/README.md)** (React / Vite)
   - Admin Dashboard to view daily statistics.
   - Live stream and real-time monitoring of entry/exit cameras.
   - Member and registered vehicle management system.
   - Historical logs and parking session history.

---

## 🚀 Quick Start (Overview)

### Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- A **Supabase** account and project (PostgreSQL Database + Storage)
- An **OpenAI** account (for the OCR API Key)

### 1. Running the Backend
```bash
cd BackEnd

# Install dependencies
pip install -r requirements.txt
pip install "websockets<16,>=14" # Required for Supabase Realtime client

# Configure Environment Variables (create .env from .env.example)
# Run the FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
API Documentation (Swagger UI) is available at `http://localhost:8000/docs`.

### 2. Running the Frontend
```bash
cd FrontEnd/LicensePlate-Web

# Install dependencies
npm install

# Run the development server
npm run dev
```
The web application is accessible at `http://localhost:5173`.

---

## 🛡️ Security
This project uses `.gitignore` to protect sensitive information. **Never commit your `.env` file to a public Git repository**, as it contains secure credentials like the Supabase Key and OpenAI API Key.