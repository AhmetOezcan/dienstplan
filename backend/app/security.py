import base64
import binascii
import hashlib
import hmac
import json
import os
import secrets
import time
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.models.user import User
from app.models.user_account_membership import UserAccountMembership


PBKDF2_ALGORITHM = "sha256"
PBKDF2_ITERATIONS = 600_000
SALT_BYTES = 16
DEVELOPER_SECRET_ENV_VAR = "DEVELOPER_INVITE_CODE_SECRET"
AUTH_TOKEN_SECRET_ENV_VAR = "AUTH_TOKEN_SECRET"
ACCESS_TOKEN_EXPIRE_SECONDS = 60 * 60 * 12
bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthContext:
    user: User
    account: Account
    membership: UserAccountMembership


def hash_password(password: str) -> str:
    if not password:
        raise ValueError("Password must not be empty")

    salt_bytes = secrets.token_bytes(SALT_BYTES)
    salt = binascii.hexlify(salt_bytes).decode("ascii")
    password_hash = hashlib.pbkdf2_hmac(
        PBKDF2_ALGORITHM,
        password.encode("utf-8"),
        salt_bytes,
        PBKDF2_ITERATIONS,
    )
    return (
        f"pbkdf2_{PBKDF2_ALGORITHM}"
        f"${PBKDF2_ITERATIONS}"
        f"${salt}"
        f"${binascii.hexlify(password_hash).decode('ascii')}"
    )


def verify_password(password: str, stored_password_hash: str) -> bool:
    if not password or not stored_password_hash:
        return False

    try:
        scheme, iterations, salt, expected_hash = stored_password_hash.split("$", maxsplit=3)
    except ValueError:
        return False

    if scheme != f"pbkdf2_{PBKDF2_ALGORITHM}":
        return False

    try:
        derived_hash = hashlib.pbkdf2_hmac(
            PBKDF2_ALGORITHM,
            password.encode("utf-8"),
            binascii.unhexlify(salt),
            int(iterations),
        )
    except (TypeError, ValueError, binascii.Error):
        return False

    return hmac.compare_digest(
        binascii.hexlify(derived_hash).decode("ascii"),
        expected_hash,
    )


def require_developer_key(x_developer_key: str | None = Header(default=None)) -> None:
    developer_secret = os.getenv(DEVELOPER_SECRET_ENV_VAR)

    if not developer_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{DEVELOPER_SECRET_ENV_VAR} is not configured",
        )

    if not x_developer_key or not hmac.compare_digest(x_developer_key, developer_secret):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Developer access required",
        )


def _base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _get_auth_token_secret() -> str:
    token_secret = os.getenv(AUTH_TOKEN_SECRET_ENV_VAR)

    if not token_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{AUTH_TOKEN_SECRET_ENV_VAR} is not configured",
        )

    return token_secret


def create_access_token(user: User, account: Account, membership_role: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(user.id),
        "account_id": account.id,
        "email": user.email,
        "membership_role": membership_role,
        "exp": int(time.time()) + ACCESS_TOKEN_EXPIRE_SECONDS,
    }

    header_segment = _base64url_encode(
        json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    payload_segment = _base64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
    signature = hmac.new(
        _get_auth_token_secret().encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    signature_segment = _base64url_encode(signature)
    return f"{header_segment}.{payload_segment}.{signature_segment}"


def decode_access_token(token: str) -> dict:
    try:
        header_segment, payload_segment, signature_segment = token.split(".", maxsplit=2)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from None

    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
    expected_signature = hmac.new(
        _get_auth_token_secret().encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()

    try:
        provided_signature = _base64url_decode(signature_segment)
        payload = json.loads(_base64url_decode(payload_segment).decode("utf-8"))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError, binascii.Error):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from None

    if not hmac.compare_digest(provided_signature, expected_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    if payload.get("exp", 0) < int(time.time()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired",
        )

    return payload


def get_single_account_membership_for_user(
    user: User,
    db: Session,
    *,
    account_id: int | None = None,
) -> UserAccountMembership:
    memberships = db.scalars(
        select(UserAccountMembership)
        .join(Account, UserAccountMembership.account_id == Account.id)
        .where(
            UserAccountMembership.user_id == user.id,
            UserAccountMembership.is_active.is_(True),
            Account.is_active.is_(True),
        )
        .order_by(UserAccountMembership.created_at.asc(), UserAccountMembership.id.asc())
    ).all()

    if not memberships:
        detail = "No active account membership found"
        if account_id is not None:
            detail = "Requested account membership is not available"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )

    if len(memberships) > 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User has multiple active account memberships; single-account model violated",
        )

    membership = memberships[0]
    if account_id is not None and membership.account_id != account_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requested account membership is not available",
        )

    return membership


def get_auth_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AuthContext:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    token_payload = decode_access_token(credentials.credentials)
    subject = token_payload.get("sub")
    token_account_id = token_payload.get("account_id")

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from None

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication user not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive",
        )

    try:
        account_id = int(token_account_id) if token_account_id is not None else None
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from None

    membership = get_single_account_membership_for_user(user, db, account_id=account_id)
    account = membership.account

    return AuthContext(user=user, account=account, membership=membership)


def get_current_user(auth_context: AuthContext = Depends(get_auth_context)) -> User:
    return auth_context.user


def get_current_account(auth_context: AuthContext = Depends(get_auth_context)) -> Account:
    return auth_context.account


def get_current_membership(
    auth_context: AuthContext = Depends(get_auth_context),
) -> UserAccountMembership:
    return auth_context.membership
