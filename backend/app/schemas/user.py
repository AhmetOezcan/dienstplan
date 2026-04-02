from pydantic import BaseModel, ConfigDict, Field, field_validator


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _normalize_invite_code(value: str) -> str:
    return value.strip()


class UserRegister(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=255)
    invite_code: str = Field(min_length=1, max_length=64)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = _normalize_email(value)
        if not normalized:
            raise ValueError("Email must not be empty")
        return normalized

    @field_validator("invite_code")
    @classmethod
    def normalize_invite_code(cls, value: str) -> str:
        normalized = _normalize_invite_code(value)
        if not normalized:
            raise ValueError("Invite code must not be empty")
        return normalized


class UserRead(BaseModel):
    id: int
    email: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class AccountRead(BaseModel):
    id: int
    name: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class RegisterResponse(BaseModel):
    message: str
    user: UserRead
    account: AccountRead
    membership_role: str


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=255)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Email must not be empty")
        return _normalize_email(normalized)


class LoginResponse(BaseModel):
    message: str
    access_token: str
    token_type: str
    user: UserRead
    account: AccountRead
    membership_role: str
