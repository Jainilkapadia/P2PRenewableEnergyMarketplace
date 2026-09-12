from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import List, Optional

class ReliabilityMetricBreakdown(BaseModel):
    metric: str
    value: str
    weight_impact: str
    description: str

class ReliabilityScoreResponse(BaseModel):
    user_id: UUID
    user_name: str
    score: float
    rating_label: str  # e.g., 'A+ Elite Prosumer', 'Gold Trusted', 'Established', etc.
    total_trades_initiated: int
    successful_transactions: int
    cancelled_transactions: int
    disputes_count: int
    completed_energy_kwh: float
    completion_rate_pct: float
    is_provable_on_chain: bool
    metrics_breakdown: List[ReliabilityMetricBreakdown]
    last_updated: datetime
