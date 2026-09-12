from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import datetime
from uuid import UUID

class EnergyRequirementCreate(BaseModel):
    title: str = "EV / Household Clean Energy Demand"
    energy_required_kwh: float = Field(gt=0, description="Total energy requirement in kWh")
    max_price_per_kwh: float = Field(gt=0, description="Maximum budget per kWh in INR")
    required_from: datetime
    required_to: datetime
    max_radius_km: Optional[float] = Field(15.0, gt=0, le=100.0, description="Maximum distance in km")
    min_seller_reliability: Optional[float] = Field(70.0, ge=0.0, le=100.0, description="Minimum reliability score required")
    latitude: Optional[float] = Field(23.0300, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(72.5350, ge=-180.0, le=180.0)
    grid_substation_id: Optional[str] = "AHMEDABAD_SUB_ZONE_1"
    preferred_substation_only: Optional[bool] = False

    @model_validator(mode="after")
    def validate_time_window(self):
        if self.required_to <= self.required_from:
            raise ValueError("required_to must be after required_from")
        return self

class EnergyRequirementUpdate(BaseModel):
    title: Optional[str] = None
    energy_required_kwh: Optional[float] = Field(None, gt=0)
    max_price_per_kwh: Optional[float] = Field(None, gt=0)
    required_from: Optional[datetime] = None
    required_to: Optional[datetime] = None
    max_radius_km: Optional[float] = Field(None, gt=0, le=100.0)
    min_seller_reliability: Optional[float] = Field(None, ge=0.0, le=100.0)
    preferred_substation_only: Optional[bool] = None
    status: Optional[str] = None

    @model_validator(mode="after")
    def validate_time_window(self):
        if self.required_from and self.required_to and self.required_to <= self.required_from:
            raise ValueError("required_to must be after required_from")
        return self

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
