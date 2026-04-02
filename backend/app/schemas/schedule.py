from datetime import date as date_type
from datetime import datetime, time

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


class ScheduleEntryBase(BaseModel):
    employee_id: int
    customer_id: int
    date: date_type
    start_time: time
    end_time: time
    notes: str | None = None

    @field_validator("notes", mode="before")
    @classmethod
    def strip_strings(cls, value: str | None) -> str | None:
        return _strip_string(value)


class ScheduleEntryCreate(ScheduleEntryBase):
    pass


class ScheduleEntryUpdate(BaseModel):
    employee_id: int | None = None
    customer_id: int | None = None
    date: date_type | None = None
    start_time: time | None = None
    end_time: time | None = None
    notes: str | None = None

    @field_validator("notes", mode="before")
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
