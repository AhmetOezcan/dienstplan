from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.employee import Employee
from app.models.user import User
from app.schemas.employee import EmployeeCreate, EmployeeRead, EmployeeUpdate

router = APIRouter()


def get_employee_or_404(employee_id: int, db: Session) -> Employee:
    employee = db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return employee


def split_employee_name(name: str) -> tuple[str, str]:
    parts = name.split(maxsplit=1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ""
    return first_name, last_name


def normalize_employee_payload(data: dict, *, partial: bool) -> dict:
    normalized = data.copy()
    name = normalized.pop("name", None)

    if name and "first_name" not in normalized:
        first_name, last_name = split_employee_name(name)
        normalized["first_name"] = first_name
        normalized["last_name"] = last_name

    if not partial:
        if normalized.get("user_id") is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_id is required",
            )
        if not normalized.get("first_name"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="first_name is required",
            )
        normalized.setdefault("last_name", "")
    elif "user_id" in normalized and normalized["user_id"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id must not be null",
        )

    if "first_name" in normalized and not normalized["first_name"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="first_name must not be empty",
        )

    if "last_name" in normalized and normalized["last_name"] is None:
        normalized["last_name"] = ""

    return normalized


def ensure_user_exists(user_id: int, db: Session) -> None:
    if db.get(User, user_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Referenced user does not exist",
        )


@router.get("/employees", response_model=list[EmployeeRead])
def list_employees(db: Session = Depends(get_db)):
    return db.scalars(
        select(Employee).order_by(Employee.first_name.asc(), Employee.last_name.asc())
    ).all()


@router.get("/employees/{employee_id}", response_model=EmployeeRead)
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    return get_employee_or_404(employee_id, db)


@router.post("/employees", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db)):
    employee_data = normalize_employee_payload(payload.model_dump(exclude_unset=True), partial=False)
    ensure_user_exists(employee_data["user_id"], db)

    employee = Employee(**employee_data)
    db.add(employee)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already linked to another employee",
        ) from None

    db.refresh(employee)
    return employee


@router.patch("/employees/{employee_id}", response_model=EmployeeRead)
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    db: Session = Depends(get_db),
):
    employee = get_employee_or_404(employee_id, db)
    updates = normalize_employee_payload(payload.model_dump(exclude_unset=True), partial=True)

    if "user_id" in updates:
        ensure_user_exists(updates["user_id"], db)

    for field, value in updates.items():
        setattr(employee, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already linked to another employee",
        ) from None

    db.refresh(employee)
    return employee


@router.delete("/employees/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    employee = get_employee_or_404(employee_id, db)
    db.delete(employee)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Employee is still referenced by schedule entries",
        ) from None

    return Response(status_code=status.HTTP_204_NO_CONTENT)
