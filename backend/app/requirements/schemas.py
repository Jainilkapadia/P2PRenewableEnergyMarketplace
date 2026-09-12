from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

class EnergyRequirementCreate(BaseModel):
    title: str = "EV / Household Clean Energy Demand"
    energy_required_kwh: float = Field(gt=0, description="Total energy requirement in kWh")
    max_price_per_kwh: float = Field(gt=0, description="Maximum budget per kWh in INR")
    required_from: datetime
    required_to: datetime
    max_radius_km: Optional[float] = 15.0
    min_seller_reliability: Optional[float] = 70.0
    latitude: Optional[float] = 23.0225
    longitude: Optional[float] = 72.5714
    grid_substation_id: Optional[str] = "AHMEDABAD_SUB_ZONE_1"
    preferred_substation_only: Optional[bool] = False

class EnergyRequirementResponse(BaseModel):
    id: UUID
    consumer_id: UUID
    consumer_name: Optional[str] = None
    title: str
    energy_required_kwh: float
    max_price_per_kwh: float
    required_from: datetime
    required_to: datetime
    max_radius_km: float
    min_seller_reliability: float
    grid_substation_id: str
    preferred_substation_only: bool
    status: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True
