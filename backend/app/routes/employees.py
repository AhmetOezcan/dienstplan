from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter()

employees = [
    {"id": 1, "name": "Ahmet"},
    {"id": 2, "name": "Ali"},
    {"id": 3, "name": "Mehmet"},
]


class EmployeeCreate(BaseModel):
    name: str


@router.get("/employees")
def get_employees():
    return employees


@router.post("/employees", status_code=status.HTTP_201_CREATED)
def create_employee(payload: EmployeeCreate):
    employee_name = payload.name.strip()

    if not employee_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee name must not be empty",
        )

    employee = {
        "id": max((employee["id"] for employee in employees), default=0) + 1,
        "name": employee_name,
    }
    employees.append(employee)
    return employee
