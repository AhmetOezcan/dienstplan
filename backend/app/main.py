import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine

from app.routes.auth import router as auth_router
from app.routes.employees import router as employees_router
from app.routes.invite_codes import router as invite_codes_router
from app.routes.customers import router as customers_router
from app.routes.schedules import router as schedules_router

CORS_ALLOW_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOW_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
LOCAL_DEV_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"

#App starten
app = FastAPI()

#Kommunikation mit frontend und backend erlauben
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_origin_regex=LOCAL_DEV_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


#datein einbinden
app.include_router(auth_router)
app.include_router(invite_codes_router)
app.include_router(employees_router)
app.include_router(customers_router)
app.include_router(schedules_router)

@app.get("/")
def root():
    with engine.connect() as connection:
        return {"message": "Backend und Datenbank verbunden"}


@app.get("/health")
def healthcheck():
    return {"status": "ok"}
