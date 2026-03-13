"""
Shared pytest fixtures — mock Supabase client and data factories.
"""

import sys
import os
from unittest.mock import MagicMock, patch

import pytest

# Ensure BackEnd is on sys.path
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)


# ── Mock Supabase before importing any app modules ──

class MockQueryBuilder:
    """Chainable mock that simulates Supabase query builder."""

    def __init__(self, data=None):
        self._data = data or []

    def select(self, *args, **kwargs):
        return self

    def insert(self, *args, **kwargs):
        return self

    def update(self, *args, **kwargs):
        return self

    def delete(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        return self

    def neq(self, *args, **kwargs):
        return self

    def ilike(self, *args, **kwargs):
        return self

    def gte(self, *args, **kwargs):
        return self

    def lte(self, *args, **kwargs):
        return self

    def lt(self, *args, **kwargs):
        return self

    def gt(self, *args, **kwargs):
        return self

    def is_(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def execute(self):
        return MagicMock(data=self._data)

    def set_data(self, data):
        self._data = data
        return self


class MockSupabaseClient:
    """Mock Supabase client good enough for unit tests."""

    def __init__(self):
        self._table_data = {}
        self.storage = MagicMock()

    def table(self, name):
        return MockQueryBuilder(self._table_data.get(name, []))

    def set_table_data(self, name, data):
        self._table_data[name] = data


@pytest.fixture
def mock_supabase():
    """Return a fresh MockSupabaseClient for each test."""
    return MockSupabaseClient()


@pytest.fixture
def sample_event():
    """Factory for an event dict."""
    return {
        "event_id": 1,
        "datetime": "2025-06-15T10:30:00+07:00",
        "plate": "1กก 1234",
        "province": "กรุงเทพมหานคร",
        "direction": "IN",
        "blob": "https://example.com/img.jpg",
        "cam_id": 1,
        "vehicle_id": None,
    }


@pytest.fixture
def sample_session_parked():
    """Factory for a parked session dict."""
    return {
        "session_id": "s1",
        "plate_number_entry": "1กก 1234",
        "province": "กรุงเทพมหานคร",
        "entry_time": "2025-06-15T08:00:00+07:00",
        "exit_time": None,
        "status": "parked",
        "entry_event_id": 1,
        "vehicle_id": None,
        "member_id": None,
    }


@pytest.fixture
def sample_member():
    """Factory for a member dict."""
    return {
        "member_id": 1,
        "firstname": "สมชาย",
        "lastname": "ใจดี",
        "std_id": 2310001234,
        "faculty": "วิศวกรรมศาสตร์",
        "major": "คอมพิวเตอร์",
        "role": "นักศึกษา",
    }
