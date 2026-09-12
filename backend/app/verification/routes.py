from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone
from typing import List
from uuid import UUID
import hashlib

from app.core.database import get_db
from app.core.crypto import verify_ed25519_signature, compute_sha256_hash
from app.auth.routes import get_current_user
from app.models import (
    User, UserKey, Trade, TradeVerification, Wallet, WalletTransaction,
    ReliabilityScore, Notification
)
from app.verification.schemas import (
    TradeSignRequest, TradeVerificationResponse,
    SignatureVerificationDetail, ProofChainBlock
)

router = APIRouter(prefix="/verification", tags=["Cryptographic Verification & Proof"])

@router.post("/sign", response_model=TradeVerificationResponse)
async def sign_trade(
    req: TradeSignRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Fetch Trade and Verification Record
    trade_res = await db.execute(select(Trade).where(Trade.id == req.trade_id))
    trade = trade_res.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found.")

    verif_res = await db.execute(select(TradeVerification).where(TradeVerification.trade_id == req.trade_id))
    verification = verif_res.scalar_one_or_none()
    if not verification:
        raise HTTPException(status_code=404, detail="Verification record not found for this trade.")

    # 2. Fetch User's Active Public Key
    key_res = await db.execute(
        select(UserKey).where(
            UserKey.user_id == current_user.id,
            UserKey.is_active == True
        ).order_by(UserKey.created_at.desc())
    )
    user_key = key_res.scalars().first()
    if not user_key:
        raise HTTPException(
            status_code=400,
            detail="User does not have an active registered public key. Please initialize keys in the key vault."
        )

    # 3. Verify Signature against Canonical Trade Hash
    is_valid = verify_ed25519_signature(
        public_key_hex=user_key.public_key_hex,
        payload_hash_hex=verification.trade_canonical_hash,
        signature_hex=req.signature_hex
    )
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail="Cryptographic verification failed: Signature does not match registered public key or canonical payload hash."
        )

    # 4. Record Signature based on Role
    now = datetime.now(timezone.utc)
    if req.signer_role.lower() == "buyer" or current_user.id == trade.buyer_id:
        verification.buyer_signature_hex = req.signature_hex
        verification.buyer_signed_at = now
        if trade.status == "pending_signatures":
            trade.status = "buyer_signed"
    elif req.signer_role.lower() == "seller" or current_user.id == trade.seller_id:
        verification.seller_signature_hex = req.signature_hex
        verification.seller_signed_at = now
        if trade.status == "pending_signatures":
            trade.status = "seller_signed"

    # 5. Check if Dual-Signature is Complete
    if verification.buyer_signature_hex and verification.seller_signature_hex and not verification.is_fully_verified:
        verification.is_fully_verified = True
        verification.verified_at = now
        trade.status = "settled"

        # Construct Audit Block Hash (Linked to previous block)
        prev_block_res = await db.execute(
            select(TradeVerification)
            .where(TradeVerification.is_fully_verified == True)
            .order_by(desc(TradeVerification.verified_at))
        )
        prev_verif = prev_block_res.scalars().first()
        prev_hash = prev_verif.current_block_hash if prev_verif and prev_verif.current_block_hash else "0" * 64
        
        block_content = f"{prev_hash}:{verification.trade_canonical_hash}:{verification.buyer_signature_hex}:{verification.seller_signature_hex}:{now.isoformat()}"
        block_hash = hashlib.sha256(block_content.encode('utf-8')).hexdigest()
        
        verification.audit_chain_previous_hash = prev_hash
        verification.current_block_hash = block_hash

        # Execute Wallet Escrow Settlement
        buyer_wallet_res = await db.execute(select(Wallet).where(Wallet.user_id == trade.buyer_id))
        seller_wallet_res = await db.execute(select(Wallet).where(Wallet.user_id == trade.seller_id))
        buyer_wallet = buyer_wallet_res.scalar_one_or_none()
        seller_wallet = seller_wallet_res.scalar_one_or_none()

        total_val = float(trade.total_amount)
        fee = round(total_val * 0.01, 4)  # 1% platform fee
        seller_payout = total_val - fee

        if buyer_wallet and seller_wallet:
            # Release escrow from buyer
            buyer_wallet.escrow_balance = max(0.0, float(buyer_wallet.escrow_balance) - total_val)
            
            # Credit seller
            seller_wallet.available_balance = float(seller_wallet.available_balance) + seller_payout
            
            tx_buyer = WalletTransaction(
                wallet_id=buyer_wallet.id,
                trade_id=trade.id,
                transaction_type="escrow_release",
                amount=total_val,
                balance_after=buyer_wallet.available_balance,
                description=f"Escrow released for energy delivery (Ref: {verification.verification_reference})"
            )
            tx_seller = WalletTransaction(
                wallet_id=seller_wallet.id,
                trade_id=trade.id,
                transaction_type="payment_credit",
                amount=seller_payout,
                balance_after=seller_wallet.available_balance,
                description=f"Energy sale payout for {trade.energy_amount_kwh} kWh (Ref: {verification.verification_reference})"
            )
            db.add_all([tx_buyer, tx_seller])

        # Update Reliability Scores
        for uid in [trade.buyer_id, trade.seller_id]:
            rel_res = await db.execute(select(ReliabilityScore).where(ReliabilityScore.user_id == uid))
            rel = rel_res.scalar_one_or_none()
            if rel:
                rel.successful_transactions += 1
                rel.total_trades_initiated += 1
                rel.completed_energy_kwh = float(rel.completed_energy_kwh) + float(trade.energy_amount_kwh)
                # Bayesian Laplace-smoothed score
                smoothed = ((rel.successful_transactions + 8) / (rel.total_trades_initiated + 10)) * 100.0
                rel.score = round(min(100.0, max(0.0, smoothed)), 2)

        # Notify both parties
        notif_b = Notification(
            user_id=trade.buyer_id,
            title="Trade Settled & Verified",
            message=f"Your energy trade {verification.verification_reference} has been fully signed and settled.",
            type="settlement_success",
            reference_id=trade.id
        )
        notif_s = Notification(
            user_id=trade.seller_id,
            title="Energy Payout Received",
            message=f"Received ${seller_payout:.2f} for trade {verification.verification_reference}.",
            type="settlement_success",
            reference_id=trade.id
        )
        db.add_all([notif_b, notif_s])

    await db.commit()
    await db.refresh(verification)
    await db.refresh(trade)

    return await get_trade_verification_details(trade.id, db)

@router.get("/verify/{trade_id}", response_model=TradeVerificationResponse)
async def get_trade_verification_details(
    trade_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    trade_res = await db.execute(select(Trade).where(Trade.id == trade_id))
    trade = trade_res.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found.")

    verif_res = await db.execute(select(TradeVerification).where(TradeVerification.trade_id == trade_id))
    verification = verif_res.scalar_one_or_none()
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not found.")

    canonical_dict = {
        "trade_id": str(trade.id),
        "buyer_id": str(trade.buyer_id),
        "seller_id": str(trade.seller_id),
        "listing_id": str(trade.listing_id),
        "energy_amount_kwh": float(trade.energy_amount_kwh),
        "unit_price": float(trade.unit_price),
        "total_amount": float(trade.total_amount),
        "delivery_start": trade.delivery_start.isoformat(),
        "delivery_end": trade.delivery_end.isoformat(),
    }

    # Fetch Buyer key & user
    buyer_user_res = await db.execute(select(User).where(User.id == trade.buyer_id))
    buyer_user = buyer_user_res.scalar_one_or_none()
    buyer_key_res = await db.execute(select(UserKey).where(UserKey.user_id == trade.buyer_id, UserKey.is_active == True))
    buyer_key = buyer_key_res.scalars().first()

    # Fetch Seller key & user
    seller_user_res = await db.execute(select(User).where(User.id == trade.seller_id))
    seller_user = seller_user_res.scalar_one_or_none()
    seller_key_res = await db.execute(select(UserKey).where(UserKey.user_id == trade.seller_id, UserKey.is_active == True))
    seller_key = seller_key_res.scalars().first()

    buyer_verif = None
    if verification.buyer_signature_hex and buyer_key:
        valid_b = verify_ed25519_signature(buyer_key.public_key_hex, verification.trade_canonical_hash, verification.buyer_signature_hex)
        buyer_verif = SignatureVerificationDetail(
            signer_id=trade.buyer_id,
            signer_name=buyer_user.full_name if buyer_user else "Buyer",
            role="buyer",
            public_key_hex=buyer_key.public_key_hex,
            signature_hex=verification.buyer_signature_hex,
            signed_at=verification.buyer_signed_at or trade.created_at,
            is_valid=valid_b
        )

    seller_verif = None
    if verification.seller_signature_hex and seller_key:
        valid_s = verify_ed25519_signature(seller_key.public_key_hex, verification.trade_canonical_hash, verification.seller_signature_hex)
        seller_verif = SignatureVerificationDetail(
            signer_id=trade.seller_id,
            signer_name=seller_user.full_name if seller_user else "Seller",
            role="seller",
            public_key_hex=seller_key.public_key_hex,
            signature_hex=verification.seller_signature_hex,
            signed_at=verification.seller_signed_at or trade.created_at,
            is_valid=valid_s
        )

    return TradeVerificationResponse(
        trade_id=trade.id,
        verification_reference=verification.verification_reference,
        trade_canonical_hash=verification.trade_canonical_hash,
        canonical_payload=canonical_dict,
        buyer_verification=buyer_verif,
        seller_verification=seller_verif,
        is_fully_verified=verification.is_fully_verified,
        audit_chain_previous_hash=verification.audit_chain_previous_hash,
        current_block_hash=verification.current_block_hash,
        verified_at=verification.verified_at
    )

@router.get("/audit-chain", response_model=List[ProofChainBlock])
async def get_public_audit_chain(db: AsyncSession = Depends(get_db)):
    """
    Returns verified blocks in the tamper-evident cryptographic trade chain.
    """
    stmt = (
        select(TradeVerification)
        .where(TradeVerification.is_fully_verified == True)
        .order_by(TradeVerification.verified_at.asc())
    )
    res = await db.execute(stmt)
    records = res.scalars().all()
    
    chain: List[ProofChainBlock] = []
    for idx, r in enumerate(records):
        chain.append(ProofChainBlock(
            block_index=idx + 1,
            trade_id=r.trade_id,
            verification_reference=r.verification_reference,
            trade_canonical_hash=r.trade_canonical_hash,
            buyer_signature_short=(r.buyer_signature_hex[:12] + "...") if r.buyer_signature_hex else "N/A",
            seller_signature_short=(r.seller_signature_hex[:12] + "...") if r.seller_signature_hex else "N/A",
            previous_hash=r.audit_chain_previous_hash or "0" * 64,
            current_hash=r.current_block_hash or "PENDING",
            timestamp=r.verified_at or datetime.now(timezone.utc)
        ))
    return chain
