from fastapi import APIRouter

#router anlegen
router = APIRouter()

#testdaten
employees = [
    {"id": 1, "name": "Ahmet"},
    {"id": 2, "name": "Ali"},
    {"id": 3, "name": "Mehmet"},
]

#bei request soll funktion aufgerufen werden liste der mitarbeiter
@router.get("/employees")
def get_employees():
    return employees