from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter()

customers = [
    {"id": 1, "name": "Hotel Alpenblick", "color": "#4f46e5"},
    {"id": 2, "name": "Praxis Huber", "color": "#16a34a"},
    {"id": 3, "name": "Bäckerei Kaya", "color": "#ea580c"},
]


class CustomerCreate(BaseModel):
    name: str
    color: str = "#2563eb"


@router.get("/customers")
def get_customers():
    return customers


@router.post("/customers", status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate):
    customer_name = payload.name.strip()
    customer_color = payload.color.strip() or "#2563eb"

    if not customer_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer name must not be empty",
        )

    customer = {
        "id": max((customer["id"] for customer in customers), default=0) + 1,
        "name": customer_name,
        "color": customer_color,
    }
    customers.append(customer)
    return customer
