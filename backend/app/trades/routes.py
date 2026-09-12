from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from uuid import UUID

from app.core.database import get_db
from app.core.crypto import compute_sha256_hash, build_canonical_trade_payload
from app.auth.routes import get_current_user
from app.models import (
    User, EnergyListing, EnergyRequirement, Trade, TradeVerification,
    Wallet, WalletTransaction, Notification
)
from app.trades.schemas import TradeInitiateRequest, TradeResponse

router = APIRouter(prefix="/trades", tags=["Trading & Orderbook"])

@router.post("/initiate", response_model=TradeResponse)
async def initiate_trade(
    req: TradeInitiateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Fetch Listing
    listing_res = await db.execute(select(EnergyListing).where(EnergyListing.id == req.listing_id))
    listing = listing_res.scalar_one_or_none()
    if not listing or listing.status not in ["active", "partially_filled"]:
        raise HTTPException(status_code=400, detail="Listing is no longer active.")
        
    if float(listing.energy_remaining_kwh) < req.energy_amount_kwh:
        raise HTTPException(
            status_code=400, 
            detail=f"Requested {req.energy_amount_kwh} kWh exceeds remaining listing capacity ({listing.energy_remaining_kwh} kWh)."
        )

    # 2. Check Buyer Wallet Balance
    wallet_res = await db.execute(select(Wallet).where(Wallet.user_id == current_user.id))
    buyer_wallet = wallet_res.scalar_one_or_none()
    total_cost = round(req.energy_amount_kwh * req.unit_price, 4)
    
    if not buyer_wallet or float(buyer_wallet.available_balance) < total_cost:
        avail = float(buyer_wallet.available_balance) if buyer_wallet else 0.0
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient wallet balance. Total cost: ${total_cost:.2f}, Available: ${avail:.2f}"
        )

    # 3. Create Trade Record
    new_trade = Trade(
        buyer_id=current_user.id,
        seller_id=listing.prosumer_id,
        listing_id=listing.id,
        requirement_id=req.requirement_id,
        energy_amount_kwh=req.energy_amount_kwh,
        unit_price=req.unit_price,
        total_amount=total_cost,
        status="pending_signatures",
        delivery_start=listing.available_from,
        delivery_end=listing.available_to,
        match_score_snapshot=req.match_score,
        match_explanation=req.match_explanation
    )
    db.add(new_trade)
    await db.flush()

    # 4. Lock Escrow Funds in Buyer Wallet
    buyer_wallet.available_balance = float(buyer_wallet.available_balance) - total_cost
    buyer_wallet.escrow_balance = float(buyer_wallet.escrow_balance) + total_cost
    
    tx_escrow = WalletTransaction(
        wallet_id=buyer_wallet.id,
        trade_id=new_trade.id,
        transaction_type="escrow_hold",
        amount=total_cost,
        balance_after=buyer_wallet.available_balance,
        description=f"Escrow hold for {req.energy_amount_kwh} kWh trade {str(new_trade.id)[:8]}"
    )
    db.add(tx_escrow)

    # 5. Decrement Listing Capacity
    listing.energy_remaining_kwh = float(listing.energy_remaining_kwh) - req.energy_amount_kwh
    if listing.energy_remaining_kwh <= 0:
        listing.status = "completed"
    else:
        listing.status = "partially_filled"

    # 6. Initialize Canonical Hash and Trade Verification Record
    canonical_dict = build_canonical_trade_payload(
        trade_id=str(new_trade.id),
        buyer_id=str(new_trade.buyer_id),
        seller_id=str(new_trade.seller_id),
        listing_id=str(new_trade.listing_id),
        energy_kwh=float(new_trade.energy_amount_kwh),
        unit_price=float(new_trade.unit_price),
        total_amount=float(new_trade.total_amount),
        currency="INR",
        delivery_start=new_trade.delivery_start,
        delivery_end=new_trade.delivery_end
    )
    trade_hash = compute_sha256_hash(canonical_dict)
    
    ref_code = f"P2P-VRF-{int(datetime.now(timezone.utc).timestamp())}-{trade_hash[:8].upper()}"
    
    verification = TradeVerification(
        trade_id=new_trade.id,
        trade_canonical_hash=trade_hash,
        verification_reference=ref_code,
        is_fully_verified=False
    )
    db.add(verification)

    # 7. Create In-App Notification for Seller
    notif = Notification(
        user_id=listing.prosumer_id,
        title="Trade Match Initiated — Signature Required",
        message=f"Buyer {current_user.full_name} initiated a trade for {req.energy_amount_kwh} kWh at ${req.unit_price:.4f}/kWh.",
        type="sign_required",
        reference_id=new_trade.id
    )
    db.add(notif)

    await db.commit()
    await db.refresh(new_trade)

    # Fetch Seller Name
    seller_res = await db.execute(select(User).where(User.id == new_trade.seller_id))
    seller = seller_res.scalar_one_or_none()

    return TradeResponse(
        id=new_trade.id,
        buyer_id=new_trade.buyer_id,
        buyer_name=current_user.full_name,
        seller_id=new_trade.seller_id,
        seller_name=seller.full_name if seller else "Prosumer",
        listing_id=new_trade.listing_id,
        requirement_id=new_trade.requirement_id,
        energy_amount_kwh=float(new_trade.energy_amount_kwh),
        unit_price=float(new_trade.unit_price),
        total_amount=float(new_trade.total_amount),
        status=new_trade.status,
        delivery_start=new_trade.delivery_start,
        delivery_end=new_trade.delivery_end,
        match_score_snapshot=float(new_trade.match_score_snapshot) if new_trade.match_score_snapshot else None,
        match_explanation=new_trade.match_explanation,
        is_fully_verified=False,
        verification_reference=ref_code,
        buyer_signed=False,
        seller_signed=False,
        trade_canonical_hash=trade_hash,
        created_at=new_trade.created_at,
        updated_at=new_trade.updated_at
    )

@router.get("/my", response_model=List[TradeResponse])
async def get_my_trades(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy.orm import aliased
    BuyerUser = aliased(User)
    SellerUser = aliased(User)

    stmt = (
        select(
            Trade,
            BuyerUser.full_name.label("buyer_full_name"),
            SellerUser.full_name.label("seller_full_name"),
            TradeVerification
        )
        .outerjoin(BuyerUser, Trade.buyer_id == BuyerUser.id)
        .outerjoin(SellerUser, Trade.seller_id == SellerUser.id)
        .outerjoin(TradeVerification, Trade.id == TradeVerification.trade_id)
        .where(or_(Trade.buyer_id == current_user.id, Trade.seller_id == current_user.id))
        .order_by(Trade.created_at.desc())
    )
    results = await db.execute(stmt)
    trades_out = []
    
    for row in results.all():
        trade, buyer_full_name, seller_full_name, verif = row
        trades_out.append(TradeResponse(
            id=trade.id,
            buyer_id=trade.buyer_id,
            buyer_name=buyer_full_name or "Buyer",
            seller_id=trade.seller_id,
            seller_name=seller_full_name or "Seller",
            listing_id=trade.listing_id,
            requirement_id=trade.requirement_id,
            energy_amount_kwh=float(trade.energy_amount_kwh),
            unit_price=float(trade.unit_price),
            total_amount=float(trade.total_amount),
            status=trade.status,
            delivery_start=trade.delivery_start,
            delivery_end=trade.delivery_end,
            match_score_snapshot=float(trade.match_score_snapshot) if trade.match_score_snapshot else None,
            match_explanation=trade.match_explanation,
            is_fully_verified=verif.is_fully_verified if verif else False,
            verification_reference=verif.verification_reference if verif else None,
            buyer_signed=bool(verif.buyer_signature_hex) if verif else False,
            seller_signed=bool(verif.seller_signature_hex) if verif else False,
            trade_canonical_hash=verif.trade_canonical_hash if verif else None,
            created_at=trade.created_at,
            updated_at=trade.updated_at
        ))
    return trades_out

@router.get("/{trade_id}", response_model=TradeResponse)
async def get_trade_details(
    trade_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Trade, TradeVerification)
        .outerjoin(TradeVerification, Trade.id == TradeVerification.trade_id)
        .where(Trade.id == trade_id)
    )
    res = await db.execute(stmt)
    row = res.first()
    if not row:
        raise HTTPException(status_code=404, detail="Trade not found.")
    trade, verif = row
        
    buyer_res = await db.execute(select(User).where(User.id == trade.buyer_id))
    seller_res = await db.execute(select(User).where(User.id == trade.seller_id))
    buyer = buyer_res.scalar_one_or_none()
    seller = seller_res.scalar_one_or_none()
    
    return TradeResponse(
        id=trade.id,
        buyer_id=trade.buyer_id,
        buyer_name=buyer.full_name if buyer else "Buyer",
        seller_id=trade.seller_id,
        seller_name=seller.full_name if seller else "Seller",
        listing_id=trade.listing_id,
        requirement_id=trade.requirement_id,
        energy_amount_kwh=float(trade.energy_amount_kwh),
        unit_price=float(trade.unit_price),
        total_amount=float(trade.total_amount),
        status=trade.status,
        delivery_start=trade.delivery_start,
        delivery_end=trade.delivery_end,
        match_score_snapshot=float(trade.match_score_snapshot) if trade.match_score_snapshot else None,
        match_explanation=trade.match_explanation,
        is_fully_verified=verif.is_fully_verified if verif else False,
        verification_reference=verif.verification_reference if verif else None,
        buyer_signed=bool(verif.buyer_signature_hex) if verif else False,
        seller_signed=bool(verif.seller_signature_hex) if verif else False,
        trade_canonical_hash=verif.trade_canonical_hash if verif else None,
        created_at=trade.created_at,
        updated_at=trade.updated_at
    )
