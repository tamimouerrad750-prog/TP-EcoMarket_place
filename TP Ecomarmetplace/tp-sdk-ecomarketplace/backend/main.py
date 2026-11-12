import time
from typing import List

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

app = FastAPI(title="EcoMarketplace Platform API", version="1.0.0")

# Base de données volatile (en mémoire)
DB_EVENTS = []

# Clés d'API attribuées aux marchands partenaires
VALID_API_KEYS = {
    "mch_live_99x821a": "EcoShop Paris",
    "mch_live_44z102b": "TechStore Europe",
}

# Facteurs d'émission arbitraires (kg CO2 / kg produit)
CO2_FACTORS = {"electronics": 12.5, "clothing": 5.0, "food": 2.0}
DEFAULT_FACTOR = 3.0


class Item(BaseModel):
    category: str  # ex: 'electronics', 'clothing', 'food'
    weightKg: float


class PurchaseEvent(BaseModel):
    orderId: str
    items: List[Item]


def authenticate(x_api_key: str | None) -> str:
    if not x_api_key or x_api_key not in VALID_API_KEYS:
        raise HTTPException(
            status_code=401,
            detail="Clé API invalide ou absente (Header 'X-API-Key' requis).",
        )
    return VALID_API_KEYS[x_api_key]


@app.get("/")
def root():
    return {"status": "online", "message": "EcoMarketplace API v1 running"}


@app.post("/v1/events/purchase")
def track_purchase(event: PurchaseEvent, x_api_key: str = Header(None)):
    """Reçoit un événement d'achat, calcule le CO2 et stocke l'information."""
    merchant = authenticate(x_api_key)

    total_co2 = sum(
        item.weightKg * CO2_FACTORS.get(item.category.lower(), DEFAULT_FACTOR)
        for item in event.items
    )

    record = {
        "merchant": merchant,
        "orderId": event.orderId,
        "co2_kg": round(total_co2, 2),
        "timestamp": time.time(),
    }
    DB_EVENTS.append(record)

    return {
        "success": True,
        "orderId": event.orderId,
        "carbonEmittedKg": record["co2_kg"],
    }


@app.get("/v1/analytics/merchant")
def get_analytics(x_api_key: str = Header(None)):
    """Retourne les métriques cumulées pour le marchand identifié."""
    merchant_name = authenticate(x_api_key)

    events = [e for e in DB_EVENTS if e["merchant"] == merchant_name]
    total_carbon = sum(e["co2_kg"] for e in events)

    return {
        "merchant": merchant_name,
        "totalOrdersTracked": len(events),
        "totalCarbonOffsetKg": round(total_carbon, 2),
    }
