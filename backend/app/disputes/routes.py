from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
from pydantic import BaseModel

from app.core.database import get_db
from app.auth.routes import get_current_user
from app.models import User, Trade, Dispute, ReliabilityScore, Wallet, WalletTransaction

router = APIRouter(prefix="/disputes", tags=["Dispute Resolution"])

class DisputeCreate(BaseModel):
    trade_id: UUID
    reason: str

class DisputeResponse(BaseModel):
    id: UUID
    trade_id: UUID
    raised_by: UUID
    reason: str
    status: str
    resolution_notes: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

@router.post("/", response_model=DisputeResponse)
async def raise_dispute(
    req: DisputeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    trade_res = await db.execute(select(Trade).where(Trade.id == req.trade_id))
    trade = trade_res.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found.")

    if current_user.id not in [trade.buyer_id, trade.seller_id]:
        raise HTTPException(status_code=403, detail="Only parties to the trade can raise a dispute.")

    trade.status = "disputed"

    dispute = Dispute(
        trade_id=trade.id,
        raised_by=current_user.id,
        reason=req.reason,
        status="pending"
    )
    db.add(dispute)
    await db.commit()
    await db.refresh(dispute)
    return dispute

@router.get("/", response_model=List[DisputeResponse])
async def list_disputes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Dispute).order_by(Dispute.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()
