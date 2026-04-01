import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.models.invite_code import InviteCode
from app.schemas.invite_code import InviteCodeCreate, InviteCodeRead
from app.security import require_developer_key

router = APIRouter()


def generate_invite_code(role: str) -> str:
    role_prefix = "-".join(role.upper().split())[:20] or "INVITE"
    return f"{role_prefix}-{secrets.token_hex(6).upper()}"


@router.post(
    "/invite-codes",
    response_model=InviteCodeRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_developer_key)],
)
def create_invite_code(payload: InviteCodeCreate, db: Session = Depends(get_db)):
    code = payload.code or generate_invite_code(payload.role)

    if payload.account_id is not None:
        account = db.get(Account, payload.account_id)
        if account is None or not account.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account not found",
            )

    existing_code = db.scalar(select(InviteCode).where(InviteCode.code == code))
    if existing_code is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invite code already exists",
        )

    invite_code = InviteCode(
        account_id=payload.account_id,
        code=code,
        role=payload.role,
        is_used=False,
    )
    db.add(invite_code)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invite code already exists",
        ) from None

    db.refresh(invite_code)
    return invite_code
