from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.schedule_entry import ScheduleEntry
from app.models.user import User
from app.schemas.schedule import ScheduleEntryCreate, ScheduleEntryRead, ScheduleEntryUpdate

router = APIRouter()


def get_schedule_entry_or_404(schedule_entry_id: int, db: Session) -> ScheduleEntry:
    schedule_entry = db.get(ScheduleEntry, schedule_entry_id)
    if schedule_entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule entry not found",
        )
    return schedule_entry


def ensure_schedule_references_exist(data: dict, db: Session) -> None:
    if "employee_id" in data and db.get(Employee, data["employee_id"]) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Referenced employee does not exist",
        )

    if "customer_id" in data and db.get(Customer, data["customer_id"]) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Referenced customer does not exist",
        )

    if "created_by_user_id" in data and db.get(User, data["created_by_user_id"]) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Referenced user does not exist",
        )


def validate_schedule_times(start_time, end_time) -> None:
    if start_time >= end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_time must be earlier than end_time",
        )


@router.get("/schedule", response_model=list[ScheduleEntryRead])
@router.get("/schedule_entries", response_model=list[ScheduleEntryRead])
@router.get("/schedule-entries", response_model=list[ScheduleEntryRead])
def list_schedule_entries(db: Session = Depends(get_db)):
    return db.scalars(
        select(ScheduleEntry).order_by(
            ScheduleEntry.year.asc(),
            ScheduleEntry.calendar_week.asc(),
            ScheduleEntry.day_of_week.asc(),
            ScheduleEntry.start_time.asc(),
        )
    ).all()


@router.get("/schedule_entries/{schedule_entry_id}", response_model=ScheduleEntryRead)
@router.get("/schedule-entries/{schedule_entry_id}", response_model=ScheduleEntryRead)
def get_schedule_entry(schedule_entry_id: int, db: Session = Depends(get_db)):
    return get_schedule_entry_or_404(schedule_entry_id, db)


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
):
    schedule_entry_data = payload.model_dump()
    ensure_schedule_references_exist(schedule_entry_data, db)
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


@router.patch("/schedule_entries/{schedule_entry_id}", response_model=ScheduleEntryRead)
@router.patch("/schedule-entries/{schedule_entry_id}", response_model=ScheduleEntryRead)
def update_schedule_entry(
    schedule_entry_id: int,
    payload: ScheduleEntryUpdate,
    db: Session = Depends(get_db),
):
    schedule_entry = get_schedule_entry_or_404(schedule_entry_id, db)
    updates = payload.model_dump(exclude_unset=True)

    ensure_schedule_references_exist(updates, db)
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
def delete_schedule_entry(schedule_entry_id: int, db: Session = Depends(get_db)):
    schedule_entry = get_schedule_entry_or_404(schedule_entry_id, db)
    db.delete(schedule_entry)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
