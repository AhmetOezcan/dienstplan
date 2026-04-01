from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class InviteCodeCreate(BaseModel):
    role: str = Field(min_length=1, max_length=50)
    code: str | None = Field(default=None, min_length=1, max_length=64)
    account_id: int | None = Field(default=None, ge=1)

    @field_validator("role")
    @classmethod
    def normalize_role(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Role must not be empty")
        return normalized

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("Code must not be empty")
        return normalizeds


class InviteCodeRead(BaseModel):
    id: int
    account_id: int | None
    code: str
    role: str
    is_used: bool
    used_by_user_id: int | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
