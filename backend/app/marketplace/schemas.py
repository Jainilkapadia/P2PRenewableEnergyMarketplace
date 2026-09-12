from pydantic import BaseModel, Field, field_validator, model_validator
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
    latitude: float = Field(ge=-90.0, le=90.0, default=23.0384)
    longitude: float = Field(ge=-180.0, le=180.0, default=72.5122)
    grid_substation_id: Optional[str] = "AHMEDABAD_SUB_ZONE_1"

    @model_validator(mode="after")
    def validate_time_window(self):
        if self.available_to <= self.available_from:
            raise ValueError("available_to must be after available_from")
        return self

class EnergyListingUpdate(BaseModel):
    title: Optional[str] = None
    energy_available_kwh: Optional[float] = Field(None, gt=0)
    energy_remaining_kwh: Optional[float] = Field(None, ge=0)
    price_per_kwh: Optional[float] = Field(None, gt=0)
    available_from: Optional[datetime] = None
    available_to: Optional[datetime] = None
    source_type: Optional[str] = None
    grid_substation_id: Optional[str] = None
    status: Optional[str] = None

    @model_validator(mode="after")
    def validate_time_window(self):
        if self.available_from and self.available_to and self.available_to <= self.available_from:
            raise ValueError("available_to must be after available_from")
        return self

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
