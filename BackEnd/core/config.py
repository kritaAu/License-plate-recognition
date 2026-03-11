"""
Application configuration — environment variables, constants, timezone.
"""

import os
import logging
import sys
from datetime import timedelta, timezone

from dotenv import load_dotenv

# ───── Logging ─────
logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger("app")
logger.setLevel(logging.INFO)

# Suppress noisy library logs
for lib in ("httpx", "httpcore", "urllib3", "supabase"):
    logging.getLogger(lib).setLevel(logging.WARNING)

# ───── Timezone ─────
try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None


def get_bkk_tz():
    """Get Bangkok timezone (UTC+7)."""
    if ZoneInfo:
        try:
            return ZoneInfo("Asia/Bangkok")
        except Exception:
            pass
    return timezone(timedelta(hours=7))


BKK = get_bkk_tz()

# ───── Environment Variables ─────
load_dotenv()

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

ALLOWED_ORIGINS: list[str] = [
    "http://localhost:5173",
    "https://lrp-web.netlify.app",
    "https://license-plate-batchapi.onrender.com",
]
