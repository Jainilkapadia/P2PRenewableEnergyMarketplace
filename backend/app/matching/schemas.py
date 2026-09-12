from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class MatchQueryRequest(BaseModel):
    energy_required_kwh: float = Field(gt=0, description="Energy required in kWh")
    max_price_per_kwh: float = Field(gt=0, description="Maximum acceptable price per kWh")
    required_from: datetime = Field(description="Start time of energy requirement")
    required_to: datetime = Field(description="End time of energy requirement")
    latitude: float = Field(default=23.0365, ge=-90.0, le=90.0, description="Consumer latitude")
    longitude: float = Field(default=72.5611, ge=-180.0, le=180.0, description="Consumer longitude")
    max_radius_km: Optional[float] = Field(default=15.0, gt=0, description="Max search radius in km")
    min_seller_reliability: Optional[float] = Field(default=70.0, ge=0, le=100, description="Min seller reliability score")
    grid_substation_id: Optional[str] = Field(default="AHMEDABAD_SUB_ZONE_1", description="Preferred substation feeder zone")
    preferred_substation_only: Optional[bool] = Field(default=False, description="Strictly match only within preferred substation")

class MatchFactor(BaseModel):
    factor: str
    impact: str  # POSITIVE, NEUTRAL, WARNING, BONUS
    weight: str
    score: Optional[float] = None
    detail: str

class MatchExplanation(BaseModel):
    summary: str
    factors: List[MatchFactor]
    trade_off_insight: Optional[str] = None

class MatchedSellerResult(BaseModel):
    listing_id: UUID
    prosumer_id: UUID
    prosumer_name: str
    listing_title: str
    energy_available_kwh: float
    price_per_kwh: float
    distance_km: float
    seller_reliability_score: float
    grid_substation_id: str
    same_substation: bool
    available_from: datetime
    available_to: datetime
    overlap_hours: float
    source_type: str
    composite_match_score: float
    rank: int
    explanation: MatchExplanation
    latitude: float
    longitude: float

class MatchSearchResponse(BaseModel):
    requirement_id: Optional[UUID] = None
    query_timestamp: datetime
    total_candidates_analyzed: int
    total_matches_returned: int
    matches: List[MatchedSellerResult]

