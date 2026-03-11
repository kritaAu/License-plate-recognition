"""
Services package — business-logic modules used by API routers and background tasks.

Modules:
    ocr_service      — GPT-4o OCR for reading Thai license plates from base64 images.
    batch_service    — FastAPI AI server (port 8001) that receives image batches,
                       detects plates with YOLO, calls OCR, and forwards events.
    matcher_service  — Async background loop that retries unmatched parking sessions.
    matching_logic   — Core plate-matching algorithm (fuzzy, province, confidence).
"""
