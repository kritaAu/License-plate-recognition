"""
Shared helper/utility functions used across routers.
"""

import logging

from core.database import supabase

logger = logging.getLogger("app")


def canon_plate(s: str | None) -> str | None:
    """Canonicalize plate number by removing whitespace."""
    if not s:
        return None
    return "".join(s.split()) or None


def canon_text(s: str | None) -> str | None:
    """Canonicalize text by stripping and lowering."""
    if not s:
        return None
    return s.strip().lower() or None


def role_from_plate_province(plate: str | None, province: str | None):
    """Get role from plate and province via Vehicle→Member lookup."""
    if not plate or not province:
        return None
    try:
        res = (
            supabase.table("Vehicle")
            .select("member:Member!Vehicle_member_id_fkey(role)")
            .ilike("plate", str(plate).strip())
            .ilike("province", str(province).strip())
            .limit(1)
            .execute()
        )
        if res.data:
            member = res.data[0].get("member") or {}
            return member.get("role")
    except Exception:
        pass
    return None


def clean_blob(blob: str | None) -> str | None:
    """Clean blob URL — return None if dummy or invalid."""
    if not blob:
        return None

    dummy_values = ["string", "test", "null", "undefined"]
    if blob.lower() in dummy_values:
        return None

    if not blob.startswith("http://") and not blob.startswith("https://"):
        return None

    return blob
