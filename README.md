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
