from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.invite_code import InviteCode
from app.models.user import User
from app.schemas.user import RegisterResponse, UserRead, UserRegister
from app.security import hash_password


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

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=invite_code.role,
        is_active=True,
    )
    db.add(user)

    try:
        db.flush()
        invite_code.is_used = True
        invite_code.used_by_user_id = user.id
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
    )
