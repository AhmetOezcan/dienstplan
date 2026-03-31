from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator


def _strip_string(value: str | None) -> str | None:
    if isinstance(value, str):
        value = value.strip()
    return value


class EmployeeCreate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    name: str | None = None
    phone: str | None = None
    notes: str | None = None
    is_active: bool = True

    @field_validator("first_name", "last_name", "name", "phone", "notes", mode="before")
    @classmethod
    def strip_strings(cls, value: str | None) -> str | None:
        return _strip_string(value)


class EmployeeUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    name: str | None = None
    phone: str | None = None
    notes: str | None = None
    is_active: bool | None = None

    @field_validator("first_name", "last_name", "name", "phone", "notes", mode="before")
    @classmethod
    def strip_strings(cls, value: str | None) -> str | None:
        return _strip_string(value)


class EmployeeRead(BaseModel):
    id: int
    first_name: str
    last_name: str
    phone: str | None
    notes: str | None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def name(self) -> str:
        return " ".join(part for part in [self.first_name, self.last_name] if part).strip()
