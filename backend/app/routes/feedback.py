from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.models.feedback_entry import FeedbackEntry
from app.schemas.feedback import (
    FeedbackEntryCreate,
    FeedbackEntryRead,
    FeedbackPublicPageRead,
    FeedbackWidgetSettingsRead,
)
from app.security import get_auth_context, get_current_account
from app.services.ip_rate_limiter import IpRateLimiter

router = APIRouter()
auth_router = APIRouter(dependencies=[Depends(get_auth_context)])

_feedback_limiter = IpRateLimiter(max_requests=5, window=timedelta(minutes=10))


def get_account_by_feedback_token(feedback_public_token: str, db: Session) -> Account:
    account = db.scalar(
        select(Account).where(
            Account.feedback_public_token == feedback_public_token,
            Account.is_active.is_(True),
        )
    )

    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback page not found",
        )

    return account


@router.get("/public-feedback/{feedback_public_token}", response_model=FeedbackPublicPageRead)
def get_public_feedback_page(
    feedback_public_token: str,
    db: Session = Depends(get_db),
):
    account = get_account_by_feedback_token(feedback_public_token, db)
    return FeedbackPublicPageRead(account_name=account.name)


@router.post(
    "/public-feedback/{feedback_public_token}",
    response_model=FeedbackEntryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_public_feedback_entry(
    feedback_public_token: str,
    payload: FeedbackEntryCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    _feedback_limiter.check(request)

    # Honeypot: bots fill the hidden "website" field, humans never see it.
    # Silently succeed so the bot assumes its request worked.
    if payload.website:
        return FeedbackEntryRead(
            id=0,
            account_id=0,
            author_name=payload.author_name,
            message=payload.message,
            created_at=datetime.now(timezone.utc),
        )

    account = get_account_by_feedback_token(feedback_public_token, db)
    feedback_entry = FeedbackEntry(account_id=account.id, **payload.model_dump(exclude={"website"}))
    db.add(feedback_entry)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback could not be submitted",
        ) from None

    db.refresh(feedback_entry)
    return feedback_entry


@auth_router.get("/feedback_entries", response_model=list[FeedbackEntryRead])
def list_feedback_entries(
    db: Session = Depends(get_db),
    current_account: Account = Depends(get_current_account),
):
    return db.scalars(
        select(FeedbackEntry)
        .where(FeedbackEntry.account_id == current_account.id)
        .order_by(FeedbackEntry.created_at.desc(), FeedbackEntry.id.desc())
    ).all()


@auth_router.get("/feedback_entries/settings", response_model=FeedbackWidgetSettingsRead)
def get_feedback_widget_settings(
    current_account: Account = Depends(get_current_account),
):
    return FeedbackWidgetSettingsRead(
        account_id=current_account.id,
        account_name=current_account.name,
        feedback_public_token=current_account.feedback_public_token,
    )
