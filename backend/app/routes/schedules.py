from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.schedule_entry import ScheduleEntry
from app.models.user import User
from app.schemas.schedule import (
    ScheduleCopyPreviousWeekRequest,
    ScheduleEntryCreate,
    ScheduleEntryRead,
    ScheduleEntryUpdate,
)
from app.security import get_auth_context, get_current_account, get_current_user

router = APIRouter(dependencies=[Depends(get_auth_context)])


def get_schedule_entry_or_404(
    schedule_entry_id: int,
    account_id: int,
    db: Session,
) -> ScheduleEntry:
    schedule_entry = db.scalar(
        select(ScheduleEntry).where(
            ScheduleEntry.id == schedule_entry_id,
            ScheduleEntry.account_id == account_id,
        )
    )
    if schedule_entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule entry not found",
        )
    return schedule_entry


def ensure_schedule_references_exist(data: dict, account_id: int, db: Session) -> None:
    if "employee_id" in data and db.scalar(
        select(Employee).where(Employee.id == data["employee_id"], Employee.account_id == account_id)
    ) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Referenced employee does not exist in your account",
        )

    if "customer_id" in data and db.scalar(
        select(Customer).where(Customer.id == data["customer_id"], Customer.account_id == account_id)
    ) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Referenced customer does not exist in your account",
        )


def validate_schedule_times(start_time, end_time) -> None:
    if start_time == end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_time and end_time must be different",
        )


def get_iso_week_bounds(year: int, calendar_week: int):
    try:
        first_day = date.fromisocalendar(year, calendar_week, 1)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ISO week selection",
        ) from exc

    return first_day, first_day + timedelta(days=6)


@router.get("/schedule", response_model=list[ScheduleEntryRead])
@router.get("/schedule_entries", response_model=list[ScheduleEntryRead])
@router.get("/schedule-entries", response_model=list[ScheduleEntryRead])
def list_schedule_entries(
    db: Session = Depends(get_db),
    current_account: Account = Depends(get_current_account),
):
    return db.scalars(
        select(ScheduleEntry).order_by(
            ScheduleEntry.date.asc(),
            ScheduleEntry.start_time.asc(),
            ScheduleEntry.id.asc(),
        )
        .where(ScheduleEntry.account_id == current_account.id)
    ).all()


@router.get("/schedule_entries/{schedule_entry_id}", response_model=ScheduleEntryRead)
@router.get("/schedule-entries/{schedule_entry_id}", response_model=ScheduleEntryRead)
def get_schedule_entry(
    schedule_entry_id: int,
    db: Session = Depends(get_db),
    current_account: Account = Depends(get_current_account),
):
    return get_schedule_entry_or_404(schedule_entry_id, current_account.id, db)


@router.post(
    "/schedule_entries",
    response_model=ScheduleEntryRead,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/schedule-entries",
    response_model=ScheduleEntryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_schedule_entry(
    payload: ScheduleEntryCreate,
    db: Session = Depends(get_db),
    current_account: Account = Depends(get_current_account),
    current_user: User = Depends(get_current_user),
):
    schedule_entry_data = payload.model_dump()
    schedule_entry_data["account_id"] = current_account.id
    schedule_entry_data["created_by_user_id"] = current_user.id
    ensure_schedule_references_exist(schedule_entry_data, current_account.id, db)
    validate_schedule_times(
        schedule_entry_data["start_time"],
        schedule_entry_data["end_time"],
    )

    schedule_entry = ScheduleEntry(**schedule_entry_data)
    db.add(schedule_entry)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Schedule entry could not be created",
        ) from None

    db.refresh(schedule_entry)
    return schedule_entry


@router.post(
    "/schedule_entries/actions/copy_previous_week",
    response_model=list[ScheduleEntryRead],
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/schedule-entries/actions/copy_previous_week",
    response_model=list[ScheduleEntryRead],
    status_code=status.HTTP_201_CREATED,
)
def copy_previous_week_schedule_entries(
    payload: ScheduleCopyPreviousWeekRequest,
    db: Session = Depends(get_db),
    current_account: Account = Depends(get_current_account),
    current_user: User = Depends(get_current_user),
):
    if db.scalar(
        select(Employee).where(
            Employee.id == payload.employee_id,
            Employee.account_id == current_account.id,
        )
    ) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Referenced employee does not exist in your account",
        )

    target_week_start, target_week_end = get_iso_week_bounds(payload.year, payload.calendar_week)
    source_week_start = target_week_start - timedelta(days=7)
    source_week_end = target_week_end - timedelta(days=7)

    source_entries = db.scalars(
        select(ScheduleEntry)
        .where(
            ScheduleEntry.account_id == current_account.id,
            ScheduleEntry.employee_id == payload.employee_id,
            ScheduleEntry.date >= source_week_start,
            ScheduleEntry.date <= source_week_end,
        )
        .order_by(
            ScheduleEntry.date.asc(),
            ScheduleEntry.start_time.asc(),
            ScheduleEntry.id.asc(),
        )
    ).all()

    if not source_entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No schedule entries found in the previous calendar week",
        )

    existing_target_entries = db.scalars(
        select(ScheduleEntry).where(
            ScheduleEntry.account_id == current_account.id,
            ScheduleEntry.employee_id == payload.employee_id,
            ScheduleEntry.date >= target_week_start,
            ScheduleEntry.date <= target_week_end,
        )
    ).all()

    if existing_target_entries and not payload.replace_existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Target calendar week already contains schedule entries",
        )

    for entry in existing_target_entries:
        db.delete(entry)

    copied_entries = []
    for entry in source_entries:
        copied_entry = ScheduleEntry(
            account_id=current_account.id,
            employee_id=entry.employee_id,
            customer_id=entry.customer_id,
            date=entry.date + timedelta(days=7),
            start_time=entry.start_time,
            end_time=entry.end_time,
            notes=entry.notes,
            created_by_user_id=current_user.id,
        )
        db.add(copied_entry)
        copied_entries.append(copied_entry)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Previous calendar week could not be copied",
        ) from None

    for entry in copied_entries:
        db.refresh(entry)

    return copied_entries


@router.patch("/schedule_entries/{schedule_entry_id}", response_model=ScheduleEntryRead)
@router.patch("/schedule-entries/{schedule_entry_id}", response_model=ScheduleEntryRead)
def update_schedule_entry(
    schedule_entry_id: int,
    payload: ScheduleEntryUpdate,
    db: Session = Depends(get_db),
    current_account: Account = Depends(get_current_account),
):
    schedule_entry = get_schedule_entry_or_404(schedule_entry_id, current_account.id, db)
    updates = payload.model_dump(exclude_unset=True)
    updates.pop("created_by_user_id", None)
    updates.pop("account_id", None)

    ensure_schedule_references_exist(updates, current_account.id, db)
    validate_schedule_times(
        updates.get("start_time", schedule_entry.start_time),
        updates.get("end_time", schedule_entry.end_time),
    )

    for field, value in updates.items():
        setattr(schedule_entry, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Schedule entry could not be updated",
        ) from None

    db.refresh(schedule_entry)
    return schedule_entry


@router.delete("/schedule_entries/{schedule_entry_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/schedule-entries/{schedule_entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule_entry(
    schedule_entry_id: int,
    db: Session = Depends(get_db),
    current_account: Account = Depends(get_current_account),
):
    schedule_entry = get_schedule_entry_or_404(schedule_entry_id, current_account.id, db)
    db.delete(schedule_entry)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
