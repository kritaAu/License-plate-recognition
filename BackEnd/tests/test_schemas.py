"""
Tests for models/schemas.py — Pydantic model validation.
"""

import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.schemas import (
    EventIn,
    EventUpdate,
    MemberCreate,
    VehicleCreate,
    RegisterRequest,
    MemberUpdate,
    LoginRequest,
)


class TestEventIn:
    def test_naive_datetime_gets_localized(self):
        e = EventIn(datetime="2025-06-15T10:30:00", plate="1กก 1234")
        assert e.datetime.tzinfo is not None

    def test_aware_datetime_stays(self):
        dt = datetime(2025, 6, 15, 10, 30, tzinfo=timezone.utc)
        e = EventIn(datetime=dt, plate="1กก 1234")
        assert e.datetime.tzinfo == timezone.utc

    def test_optional_fields_default_none(self):
        e = EventIn(datetime="2025-06-15T10:30:00")
        assert e.plate is None
        assert e.province is None
        assert e.cam_id is None
        assert e.blob is None
        assert e.vehicle_id is None
        assert e.direction is None


class TestEventUpdate:
    def test_both_none_valid(self):
        u = EventUpdate()
        assert u.plate is None
        assert u.province is None

    def test_plate_only(self):
        u = EventUpdate(plate="1กก 1234")
        assert u.plate == "1กก 1234"
        assert u.province is None

    def test_both_set(self):
        u = EventUpdate(plate="1กก 1234", province="กรุงเทพมหานคร")
        assert u.plate == "1กก 1234"
        assert u.province == "กรุงเทพมหานคร"


class TestMemberCreate:
    def test_student_defaults(self):
        m = MemberCreate(firstname="สม", lastname="ชาย")
        assert m.role == "นักศึกษา"

    def test_lecturer_role(self):
        m = MemberCreate(firstname="สม", lastname="ชาย", role="อาจารย์")
        assert m.role == "อาจารย์"

    def test_std_id_as_string(self):
        m = MemberCreate(firstname="สม", lastname="ชาย", std_id="123456")
        assert m.std_id == "123456"

    def test_std_id_as_int(self):
        m = MemberCreate(firstname="สม", lastname="ชาย", std_id=123456)
        assert m.std_id == 123456


class TestMemberUpdate:
    def test_partial_update(self):
        u = MemberUpdate(firstname="ใหม่")
        assert u.firstname == "ใหม่"
        assert u.lastname is None

    def test_empty_model(self):
        u = MemberUpdate()
        data = u.model_dump(exclude_none=True)
        assert data == {}


class TestRegisterRequest:
    def test_nested_structure(self):
        r = RegisterRequest(
            member=MemberCreate(firstname="สม", lastname="ชาย"),
            vehicle=VehicleCreate(plate="1กก 1234", province="กรุงเทพมหานคร"),
        )
        assert r.member.firstname == "สม"
        assert r.vehicle.plate == "1กก 1234"


class TestLoginRequest:
    def test_basic(self):
        lr = LoginRequest(username="admin", password="secret")
        assert lr.username == "admin"
        assert lr.password == "secret"
