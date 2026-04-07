from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    AccountRead,
    CompleteUserSetupRequest,
    CompleteUserSetupResponse,
    LoginRequest,
    LoginResponse,
    RegisterResponse,
    UserRead,
    UserRegister,
)
from app.security import (
    AuthContext,
    create_access_token,
    get_auth_context_allow_incomplete_setup,
    get_single_account_membership_for_user,
    hash_password,
    verify_password,
)
from app.services.login_abuse_protection import (
    clear_email_login_rate_limit,
    enforce_login_rate_limit,
    get_login_client_ip,
    register_failed_login,
)
from app.services.user_registration import register_user_with_invite_code

router = APIRouter()


@router.post("/auth/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    return register_user_with_invite_code(payload, db)


@router.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = get_login_client_ip(request)
    enforce_login_rate_limit(payload.email, client_ip, db)

    user = db.scalar(select(User).where(User.email == payload.email))

    if user is None or not verify_password(payload.password, user.password_hash):
        register_failed_login(payload.email, client_ip, db)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive",
        )

    membership = get_single_account_membership_for_user(user, db)
    access_token = create_access_token(user, membership.account, membership.role)
    clear_email_login_rate_limit(payload.email, db)

    return LoginResponse(
        message="Login successful",
        access_token=access_token,
        token_type="bearer",
        user=UserRead.model_validate(user),
        account=AccountRead.model_validate(membership.account),
        membership_role=membership.role,
    )


@router.post("/auth/complete-setup", response_model=CompleteUserSetupResponse)
def complete_user_setup(
    payload: CompleteUserSetupRequest,
    auth_context: AuthContext = Depends(get_auth_context_allow_incomplete_setup),
    db: Session = Depends(get_db),
):
    user = auth_context.user

    if not user.must_complete_setup:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Initial account setup is already complete",
        )

    user.full_name = payload.full_name
    user.password_hash = hash_password(payload.new_password)
    user.must_complete_setup = False
    db.commit()
    db.refresh(user)

    return CompleteUserSetupResponse(
        message="Initial account setup completed",
        user=UserRead.model_validate(user),
    )
