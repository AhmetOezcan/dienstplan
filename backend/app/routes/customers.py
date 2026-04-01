from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account
from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerRead, CustomerUpdate
from app.security import get_auth_context, get_current_account

router = APIRouter(dependencies=[Depends(get_auth_context)])


def get_customer_or_404(customer_id: int, account_id: int, db: Session) -> Customer:
    customer = db.scalar(
        select(Customer).where(Customer.id == customer_id, Customer.account_id == account_id)
    )
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )
    return customer


@router.get("/customers", response_model=list[CustomerRead])
def list_customers(
    db: Session = Depends(get_db),
    current_account: Account = Depends(get_current_account),
):
    return db.scalars(
        select(Customer)
        .where(Customer.account_id == current_account.id)
        .order_by(Customer.name.asc())
    ).all()


@router.get("/customers/{customer_id}", response_model=CustomerRead)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_account: Account = Depends(get_current_account),
):
    return get_customer_or_404(customer_id, current_account.id, db)


@router.post("/customers", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    current_account: Account = Depends(get_current_account),
):
    customer = Customer(account_id=current_account.id, **payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.patch("/customers/{customer_id}", response_model=CustomerRead)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current_account: Account = Depends(get_current_account),
):
    customer = get_customer_or_404(customer_id, current_account.id, db)
    updates = payload.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_account: Account = Depends(get_current_account),
):
    customer = get_customer_or_404(customer_id, current_account.id, db)
    db.delete(customer)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Customer is still referenced by schedule entries",
        ) from None

    return Response(status_code=status.HTTP_204_NO_CONTENT)
