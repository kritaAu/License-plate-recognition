# Backend - License Plate Recognition ⚙️

The core APi service that manages data operations, AI processing for license plate detection (from image capture to database persistence), and the entire business logic flow.

## 🌟 Key Features
- **AI Processing Unit**: 
  - `batch_process.py`: Script to receive camera images, run the YOLO model to detect motorcycles and license plates.
  - `OCR_ai.py`: Sends cropped plate images to OpenAI (GPT-4o) for Optical Character Recognition (OCR).
- **Modular API Architecture**: Cleanly separated endpoints (`/api/auth`, `/api/members`, `/api/events`, `/api/parking`, `/dashboard`).
- **Smart Matching Logic**: Advanced algorithms (Exact & Fuzzy matching) to pair vehicle exits (`OUT`) with their respective entries (`IN`), compensating for minor OCR inaccuracies (`matching_logic.py`, `background_matcher.py`).
- **Realtime WebSocket**: Broadcasts live vehicle entry and exit events to connected frontend clients immediately.
- **Database Schema (Supabase)**: Utilizes tables for `Users`, `Member`, `Vehicle`, `Event`, and `ParkingSession`.

---

## 📁 Folder Structure

```
BackEnd/
├── .env                 # (Ignored in Git) Environment variables
├── main_api.py          # FastAPI application entry point
├── helpers.py           # Shared utility functions
├── utils.py             # Image processing and Storage upload helpers
├── OCR_ai.py            # OpenAI OCR integration
├── batch_process.py     # AI Batch Processing service
├── matching_logic.py    # Plate matching logic (Exact, Fuzzy)
├── background_matcher.py# Background task to match orphaned sessions
├── core/                # Core system configuration
│   ├── config.py
│   ├── database.py      # Shared Supabase Client
│   ├── security.py      # JWT & Authentication logic
│   └── websocket.py     # Global WebSocket Manager
├── models/
│   └── schemas.py       # Pydantic Request/Response models
└── routers/             # API Routers organized by feature
    ├── auth.py
    ├── dashboard.py
    ├── events.py
    ├── members.py
    ├── parking.py
    └── upload_export.py
```

---

## ⚙️ Environment Configuration (`.env`)

You must create a `.env` file in the root of the `BackEnd/` directory with the following keys:
```env
# Supabase Database Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key

# JWT Encryption Key (Use a strong, random string)
SECRET_KEY=generate_your_own_secret_key_here

# OpenAI API Key (for OCR functionality)
OPENAI_API_KEY=sk-your_openai_api_key

# Initial Admin Credentials (used with the DB)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_password
```

---

## 🛠️ Installation & Execution

1. **Install Python Dependencies**:
   ```bash
   pip install -r requirements.txt
   pip install "websockets<16,>=14"
   ```
2. **Setup YOLO Models**:
   > 📌 *The system requires `.pt` models for Ultralytics YOLO to be placed in the `/models` directory (as referenced in the code).*
3. **Start the API Server**:
   ```bash
   uvicorn main_api:app --reload
   ```

The system will start on `http://127.0.0.1:8000`, and you can view the active API endpoints at `http://127.0.0.1:8000/docs`.