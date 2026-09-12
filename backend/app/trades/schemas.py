from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID

class TradeInitiateRequest(BaseModel):
    listing_id: UUID
    requirement_id: Optional[UUID] = None
    energy_amount_kwh: float = Field(gt=0)
    unit_price: float = Field(gt=0)
    match_score: Optional[float] = None
    match_explanation: Optional[Dict[str, Any]] = None

class TradeResponse(BaseModel):
    id: UUID
    buyer_id: UUID
    buyer_name: Optional[str] = None
    seller_id: UUID
    seller_name: Optional[str] = None
    listing_id: UUID
    requirement_id: Optional[UUID] = None
    energy_amount_kwh: float
    unit_price: float
    total_amount: float
    status: str
    delivery_start: datetime
    delivery_end: datetime
    match_score_snapshot: Optional[float] = None
    match_explanation: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
