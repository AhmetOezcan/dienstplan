from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator


def _strip_string(value: str | None) -> str | None:
    if isinstance(value, str):
        value = value.strip()
    return value


class ScheduleEntryBase(BaseModel):
    employee_id: int
    customer_id: int
    year: int
    calendar_week: int = Field(ge=1, le=53)
    day_of_week: str = Field(min_length=1, max_length=20)
    start_time: time
    end_time: time
    notes: str | None = None

    @field_validator("day_of_week", "notes", mode="before")
    @classmethod
    def strip_strings(cls, value: str | None) -> str | None:
        return _strip_string(value)


class ScheduleEntryCreate(ScheduleEntryBase):
    pass


class ScheduleEntryUpdate(BaseModel):
    employee_id: int | None = None
    customer_id: int | None = None
    year: int | None = None
    calendar_week: int | None = Field(default=None, ge=1, le=53)
    day_of_week: str | None = Field(default=None, min_length=1, max_length=20)
    start_time: time | None = None
    end_time: time | None = None
    notes: str | None = None

    @field_validator("day_of_week", "notes", mode="before")
    @classmethod
    def strip_strings(cls, value: str | None) -> str | None:
        return _strip_string(value)


class ScheduleEntryRead(ScheduleEntryBase):
    id: int
    created_by_user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def day(self) -> str:
        return self.day_of_week

    @computed_field
    @property
    def time(self) -> str:
        return self.start_time.strftime("%H:%M")
