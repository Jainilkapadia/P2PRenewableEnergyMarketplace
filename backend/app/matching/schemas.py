from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class MatchQueryRequest(BaseModel):
    energy_required_kwh: float = Field(gt=0)
    max_price_per_kwh: float = Field(gt=0)
    required_from: datetime
    required_to: datetime
    latitude: float = 23.0225
    longitude: float = 72.5714
    max_radius_km: Optional[float] = 15.0
    min_seller_reliability: Optional[float] = 70.0
    grid_substation_id: Optional[str] = "AHMEDABAD_SUB_ZONE_1"
    preferred_substation_only: Optional[bool] = False

class MatchFactor(BaseModel):
    factor: str
    impact: str  # POSITIVE, NEUTRAL, WARNING, BONUS
    weight: str
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
    source_type: str
    composite_match_score: float
    rank: int
    explanation: MatchExplanation
    latitude: float
    longitude: float

class MatchSearchResponse(BaseModel):
    query_timestamp: datetime
    total_candidates_analyzed: int
    total_matches_returned: int
    matches: List[MatchedSellerResult]
