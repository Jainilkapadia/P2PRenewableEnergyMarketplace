from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import datetime, timezone

from app.core.database import get_db
from app.models import ReliabilityScore, User
from app.reliability.schemas import ReliabilityScoreResponse, ReliabilityMetricBreakdown

router = APIRouter(prefix="/reliability", tags=["Verifiable Reliability"])

@router.get("/{user_id}", response_model=ReliabilityScoreResponse)
async def get_user_reliability(
    user_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    rel_res = await db.execute(select(ReliabilityScore).where(ReliabilityScore.user_id == user_id))
    rel = rel_res.scalar_one_or_none()
    
    score_val = float(rel.score) if rel else 100.0
    total_trades = rel.total_trades_initiated if rel else 0
    successful = rel.successful_transactions if rel else 0
    cancelled = rel.cancelled_transactions if rel else 0
    disputes = rel.disputes_count if rel else 0
    kwh = float(rel.completed_energy_kwh) if rel else 0.0

    completion_rate = round((successful / total_trades) * 100, 1) if total_trades > 0 else 100.0

    if score_val >= 95.0:
        label = "A+ Elite Verified Peer"
    elif score_val >= 85.0:
        label = "A Trusted Grid Participant"
    elif score_val >= 70.0:
        label = "B Established Standard"
    else:
        label = "C Under Review"

    breakdown = [
        ReliabilityMetricBreakdown(
            metric="Successful Dual-Signed Trades",
            value=f"{successful} of {total_trades}",
            weight_impact="+Base (100%)",
            description="Verified cryptographic trade receipts permanently anchored in the ledger."
        ),
        ReliabilityMetricBreakdown(
            metric="Completed Energy Volume",
            value=f"{kwh:,.1f} kWh",
            weight_impact="+Volume Confidence",
            description="Physical clean energy kilowatt-hours successfully transmitted."
        ),
        ReliabilityMetricBreakdown(
            metric="Cancellations Penalty",
            value=f"{cancelled}",
            weight_impact="-15.0 pts per breach" if cancelled > 0 else "0 (No Breaches)",
            description="Unilateral cancellations post-matching."
        ),
        ReliabilityMetricBreakdown(
            metric="Arbitrated Disputes",
            value=f"{disputes}",
            weight_impact="-25.0 pts per fault" if disputes > 0 else "0 (Clean History)",
            description="Grid operator or peer-dispute resolutions at seller fault."
        ),
    ]

    return ReliabilityScoreResponse(
        user_id=user.id,
        user_name=user.full_name,
        score=score_val,
        rating_label=label,
        total_trades_initiated=total_trades,
        successful_transactions=successful,
        cancelled_transactions=cancelled,
        disputes_count=disputes,
        completed_energy_kwh=kwh,
        completion_rate_pct=completion_rate,
        is_provable_on_chain=True,
        metrics_breakdown=breakdown,
        last_updated=rel.last_updated if rel else datetime.now(timezone.utc)
    )
