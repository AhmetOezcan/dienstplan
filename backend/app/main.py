from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import app.models  # noqa: F401
from app.database import Base, engine

from app.routes.auth import router as auth_router
from app.routes.employees import router as employees_router
from app.routes.invite_codes import router as invite_codes_router
from app.routes.customers import router as customers_router
from app.routes.schedules import router as schedules_router
from app.routes.users import router as users_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


#App starten
app = FastAPI(lifespan=lifespan)

#Kommunikation mit frontend und backend erlauben
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


#datein einbinden
app.include_router(auth_router)
app.include_router(invite_codes_router)
app.include_router(users_router)
app.include_router(employees_router)
app.include_router(customers_router)
app.include_router(schedules_router)

@app.get("/")
def root():
    with engine.connect() as connection:
        return {"message": "Backend und Datenbank verbunden"}
