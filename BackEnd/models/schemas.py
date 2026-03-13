"""
Pydantic request/response models.
"""

from datetime import datetime
from typing import Optional, Union, Literal

from pydantic import BaseModel, field_validator

from core.config import BKK


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class EventIn(BaseModel):
    datetime: datetime
    plate: str | None = None
    province: str | None = None
    cam_id: int | None = None
    blob: str | None = None
    vehicle_id: int | None = None
    direction: str | None = None

    @field_validator("datetime")
    @classmethod
    def localize_datetime(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            return v.replace(tzinfo=BKK)
        return v


class EventUpdate(BaseModel):
    plate: str | None = None
    province: str | None = None


class MemberCreate(BaseModel):
    firstname: str
    lastname: str
    std_id: Optional[Union[int, str]] = None
    faculty: Optional[str] = None
    major: Optional[str] = None
    role: Literal["นักศึกษา", "อาจารย์", "เจ้าหน้าที่", "อื่น ๆ", "อื่นๆ"] = "นักศึกษา"


class VehicleCreate(BaseModel):
    plate: str
    province: str


class RegisterRequest(BaseModel):
    member: MemberCreate
    vehicle: VehicleCreate


class MemberUpdate(BaseModel):
    firstname: str | None = None
    lastname: str | None = None
    std_id: int | None = None
    faculty: str | None = None
    major: str | None = None
    role: str | None = None
