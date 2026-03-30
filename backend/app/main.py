from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.employees import router as employees_router
from app.routes.customers import router as customers_router
from app.routes.schedules import router as schedules_router

#App starten
app = FastAPI()

#Kommunikation mit frontend und backend erlauben
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Dienstplan Backend läuft"}


#datein einbinden
app.include_router(employees_router)
app.include_router(customers_router)
app.include_router(schedules_router)