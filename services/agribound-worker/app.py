from fastapi.middleware.cors import CORSMiddleware

from app_light import app
from cpn_risk import register_cpn_routes

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
register_cpn_routes(app)
