from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

class EnergyListingCreate(BaseModel):
    title: str = "Rooftop Solar Clean Surplus"
    energy_available_kwh: float = Field(gt=0, description="Total energy quantity in kWh")
    price_per_kwh: float = Field(gt=0, description="Price per unit in INR")
    available_from: datetime
    available_to: datetime
    source_type: Optional[str] = "solar_rooftop"
    latitude: float = 23.0225
    longitude: float = 72.5714
    grid_substation_id: Optional[str] = "AHMEDABAD_SUB_ZONE_1"

class EnergyListingResponse(BaseModel):
    id: UUID
    prosumer_id: UUID
    prosumer_name: Optional[str] = None
    title: str
    energy_available_kwh: float
    energy_remaining_kwh: float
    price_per_kwh: float
    available_from: datetime
    available_to: datetime
    source_type: str
    grid_substation_id: str
    status: str
    latitude: float
    longitude: float
    distance_km: Optional[float] = None
    seller_reliability_score: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True
