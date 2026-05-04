from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _strip_string(value: str | None) -> str | None:
    if value is None:
        return None

    normalized_value = " ".join(value.strip().split())
    return normalized_value or None


class FeedbackEntryCreate(BaseModel):
    author_name: str | None = Field(default=None, max_length=255)
    message: str = Field(min_length=1, max_length=4000)
    # Honeypot: must always be empty. Bots auto-fill it; real users never see it.
    website: str | None = Field(default=None, max_length=255)

    @field_validator("author_name", "message", mode="before")
    @classmethod
    def strip_strings(cls, value: str | None) -> str | None:
        return _strip_string(value)

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str | None) -> str:
        if not value:
            raise ValueError("message must not be empty")

        return value


class FeedbackEntryRead(BaseModel):
    id: int
    account_id: int
    author_name: str | None
    message: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FeedbackWidgetSettingsRead(BaseModel):
    account_id: int
    account_name: str
    feedback_public_token: str


class FeedbackPublicPageRead(BaseModel):
    account_name: str
