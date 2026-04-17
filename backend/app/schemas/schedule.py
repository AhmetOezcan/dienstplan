from datetime import date as date_type
from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, computed_field, field_validator


def _strip_string(value: str | None) -> str | None:
    if isinstance(value, str):
        value = value.strip()
    return value


WEEKDAY_NAMES = {
    1: "Montag",
    2: "Dienstag",
    3: "Mittwoch",
    4: "Donnerstag",
    5: "Freitag",
    6: "Samstag",
    7: "Sonntag",
}

SCHEDULE_SHIFT_TYPES = ("day", "night")
ScheduleShiftType = Literal["day", "night"]


class ScheduleEntryBase(BaseModel):
    employee_id: int
    customer_id: int
    date: date_type
    shift_type: ScheduleShiftType = "day"
    start_time: time
    end_time: time
    notes: str | None = None

    @field_validator("notes", mode="before")
    @classmethod
    def strip_strings(cls, value: str | None) -> str | None:
        return _strip_string(value)

    @field_validator("shift_type", mode="before")
    @classmethod
    def normalize_shift_type(cls, value: str | None) -> str:
        normalized_value = _strip_string(value)
        if not normalized_value:
            return "day"

        normalized_value = normalized_value.lower()
        if normalized_value not in SCHEDULE_SHIFT_TYPES:
            raise ValueError("shift_type must be 'day' or 'night'")

        return normalized_value


class ScheduleEntryCreate(ScheduleEntryBase):
    pass


class ScheduleCopyPreviousWeekRequest(BaseModel):
    employee_id: int
    year: int
    calendar_week: int
    shift_type: ScheduleShiftType = "day"
    replace_existing: bool = False


class ScheduleEntryUpdate(BaseModel):
    employee_id: int | None = None
    customer_id: int | None = None
    date: date_type | None = None
    shift_type: ScheduleShiftType | None = None
    start_time: time | None = None
    end_time: time | None = None
    notes: str | None = None

    @field_validator("notes", mode="before")
    @classmethod
    def strip_strings(cls, value: str | None) -> str | None:
        return _strip_string(value)

    @field_validator("shift_type", mode="before")
    @classmethod
    def normalize_shift_type(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized_value = _strip_string(value)
        if not normalized_value:
            return None

        normalized_value = normalized_value.lower()
        if normalized_value not in SCHEDULE_SHIFT_TYPES:
            raise ValueError("shift_type must be 'day' or 'night'")

        return normalized_value


class ScheduleEntryRead(ScheduleEntryBase):
    id: int
    created_by_user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def year(self) -> int:
        return self.date.isocalendar().year

    @computed_field
    @property
    def calendar_week(self) -> int:
        return self.date.isocalendar().week

    @computed_field
    @property
    def day_of_week(self) -> str:
        return WEEKDAY_NAMES[self.date.isoweekday()]

    @computed_field
    @property
    def day(self) -> str:
        return self.day_of_week

    @computed_field
    @property
    def time(self) -> str:
        return self.start_time.strftime("%H:%M")
