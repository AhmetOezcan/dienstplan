from fastapi import APIRouter

router = APIRouter()

customers = [
    {"id": 1, "name": "Hotel Alpenblick", "color": "#4f46e5"},
    {"id": 2, "name": "Praxis Huber", "color": "#16a34a"},
    {"id": 3, "name": "Bäckerei Kaya", "color": "#ea580c"},
]

@router.get("/customers")
def get_customers():
    return customers