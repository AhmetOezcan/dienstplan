from fastapi import APIRouter

router = APIRouter()

schedule_entries = [
    {
        "id": 1,
        "employee_id": 1,
        "year": 2026,
        "calendar_week": 14,
        "day": "Montag",
        "time": "08:00",
        "customer_id": 1
    }
]

@router.get("/schedule")
def get_schedule():
    return schedule_entries