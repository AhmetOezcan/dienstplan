from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.invite_code import InviteCode
from app.models.user import User
from app.models.user_account_membership import UserAccountMembership
from app.schemas.user import AccountRead, RegisterResponse, UserRead, UserRegister
from app.security import hash_password


def derive_default_account_name(email: str) -> str:
    local_part = email.split("@", maxsplit=1)[0]
    normalized = " ".join(local_part.replace(".", " ").replace("_", " ").replace("-", " ").split())
    if not normalized:
        return "New Account"
    return f"{normalized.title()} Account"


def register_user_with_invite_code(payload: UserRegister, db: Session) -> RegisterResponse:
    existing_user = db.scalar(select(User).where(User.email == payload.email))
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already in use",
        )

    invite_code = db.scalar(
        select(InviteCode)
        .where(InviteCode.code == payload.invite_code, InviteCode.is_used.is_(False))
        .with_for_update()
    )
    if invite_code is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invite code is invalid or already used",
        )

    account = None
    membership_role = invite_code.role

    if invite_code.account_id is not None:
        account = db.get(Account, invite_code.account_id)
        if account is None or not account.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invite code account is not available",
            )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        is_active=True,
    )
    db.add(user)

    try:
        db.flush()

        if account is None:
            account = Account(name=derive_default_account_name(payload.email), is_active=True)
            db.add(account)
            db.flush()

        membership = UserAccountMembership(
            user_id=user.id,
            account_id=account.id,
            role=membership_role,
            is_active=True,
        )
        db.add(membership)

        invite_code.is_used = True
        invite_code.used_by_user_id = user.id
        invite_code.account_id = account.id
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration could not be completed",
        ) from None

    db.refresh(user)
    return RegisterResponse(
        message="Registration successful",
        user=UserRead.model_validate(user),
        account=AccountRead.model_validate(account),
        membership_role=membership_role,
    )
