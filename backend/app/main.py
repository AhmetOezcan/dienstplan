import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app.database import engine

from app.routes.auth import router as auth_router
from app.routes.employees import router as employees_router
from app.routes.feedback import auth_router as feedback_auth_router
from app.routes.feedback import router as feedback_router
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

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


#App starten
app = FastAPI()

app.add_middleware(SecurityHeadersMiddleware)

#Kommunikation mit frontend und backend erlauben
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_origin_regex=LOCAL_DEV_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


#datein einbinden
app.include_router(auth_router)
app.include_router(feedback_router)
app.include_router(feedback_auth_router)
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
