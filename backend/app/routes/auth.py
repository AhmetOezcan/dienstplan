from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    AccountRead,
    LoginRequest,
    LoginResponse,
    RegisterResponse,
    UserRead,
    UserRegister,
)
from app.security import create_access_token, get_active_membership_for_user, verify_password
from app.services.user_registration import register_user_with_invite_code

router = APIRouter()


@router.post("/auth/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    return register_user_with_invite_code(payload, db)


@router.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive",
        )

    membership = get_active_membership_for_user(user, db)
    access_token = create_access_token(user, membership.account, membership.role)

    return LoginResponse(
        message="Login successful",
        access_token=access_token,
        token_type="bearer",
        user=UserRead.model_validate(user),
        account=AccountRead.model_validate(membership.account),
        membership_role=membership.role,
    )
