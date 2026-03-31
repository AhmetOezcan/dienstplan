from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _strip_string(value: str | None) -> str | None:
    if isinstance(value, str):
        value = value.strip()
    return value


class CustomerBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    address: str | None = None
    color: str = Field(default="#2563eb", max_length=20)
    notes: str | None = None
    is_active: bool = True

    @field_validator("name", "address", "color", "notes", mode="before")
    @classmethod
    def strip_strings(cls, value: str | None) -> str | None:
        return _strip_string(value)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not value:
            raise ValueError("Name must not be empty")
        return value

    @field_validator("color")
    @classmethod
    def normalize_color(cls, value: str) -> str:
        return value or "#2563eb"


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    address: str | None = None
    color: str | None = Field(default=None, max_length=20)
    notes: str | None = None
    is_active: bool | None = None

    @field_validator("name", "address", "color", "notes", mode="before")
    @classmethod
    def strip_strings(cls, value: str | None) -> str | None:
        return _strip_string(value)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value == "":
            raise ValueError("Name must not be empty")
        return value

    @field_validator("color")
    @classmethod
    def normalize_color(cls, value: str | None) -> str | None:
        if value == "":
            return "#2563eb"
        return value


class CustomerRead(CustomerBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
