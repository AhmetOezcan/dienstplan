from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.user import RegisterResponse, UserRegister
from app.services.user_registration import register_user_with_invite_code

router = APIRouter()


@router.post("/users", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserRegister, db: Session = Depends(get_db)):
    return register_user_with_invite_code(payload, db)
