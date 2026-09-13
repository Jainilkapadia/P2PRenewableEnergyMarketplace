from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from uuid import UUID

from app.core.database import get_db
from app.core.crypto import (
    verify_ed25519_signature,
    compute_sha256_hash,
    build_canonical_trade_payload,
    compute_audit_block_hash
)
from app.auth.routes import get_current_user
from app.models import User, UserKey, Trade, TradeVerification
from app.auth.schemas import KeyRegister
from app.verification.schemas import (
    BuyerSignRequest,
    SellerSignRequest,
    TradeSignRequest,
    TradeVerificationResponse,
    SignatureVerificationDetail,
    ProofChainBlock,
    TamperVerifyRequest,
    TamperVerifyResponse,
    BlockchainProofResponse
)
from app.verification.blockchain_service import blockchain_service, BlockchainServiceError
from app.notifications.routes import create_user_notification

router = APIRouter(prefix="/verification", tags=["Cryptographic Verification & Proof"])

async def get_or_create_verification(trade: Trade, db: AsyncSession) -> TradeVerification:
    """Helper to fetch or initialize the TradeVerification record for a given trade."""
    verif_res = await db.execute(select(TradeVerification).where(TradeVerification.trade_id == trade.id))
    verification = verif_res.scalar_one_or_none()
    
    canonical_dict = build_canonical_trade_payload(
        trade_id=str(trade.id),
        buyer_id=str(trade.buyer_id),
        seller_id=str(trade.seller_id),
        listing_id=str(trade.listing_id),
        energy_kwh=float(trade.energy_amount_kwh),
        unit_price=float(trade.unit_price),
        total_amount=float(trade.total_amount),
        currency="INR",
        delivery_start=trade.delivery_start,
        delivery_end=trade.delivery_end
    )
    trade_hash = compute_sha256_hash(canonical_dict)

    if not verification:
        ref_code = f"P2P-VRF-{int(datetime.now(timezone.utc).timestamp())}-{trade_hash[:8].upper()}"
        verification = TradeVerification(
            trade_id=trade.id,
            trade_canonical_hash=trade_hash,
            verification_reference=ref_code,
            is_fully_verified=False
        )
        db.add(verification)
        await db.flush()
    else:
        # Ensure hash reflects authoritative trade payload
        if verification.trade_canonical_hash != trade_hash and not verification.is_fully_verified:
            verification.trade_canonical_hash = trade_hash
            await db.flush()

    return verification

async def build_verification_response(trade: Trade, verification: TradeVerification, db: AsyncSession) -> TradeVerificationResponse:
    canonical_dict = build_canonical_trade_payload(
        trade_id=str(trade.id),
        buyer_id=str(trade.buyer_id),
        seller_id=str(trade.seller_id),
        listing_id=str(trade.listing_id),
        energy_kwh=float(trade.energy_amount_kwh),
        unit_price=float(trade.unit_price),
        total_amount=float(trade.total_amount),
        currency="INR",
        delivery_start=trade.delivery_start,
        delivery_end=trade.delivery_end
    )

    # Fetch Buyer key & user
    buyer_user_res = await db.execute(select(User).where(User.id == trade.buyer_id))
    buyer_user = buyer_user_res.scalar_one_or_none()
    buyer_key_res = await db.execute(select(UserKey).where(UserKey.user_id == trade.buyer_id, UserKey.is_active == True).order_by(UserKey.created_at.desc()))
    buyer_key = buyer_key_res.scalars().first()
    if not buyer_key:
        buyer_key_any = await db.execute(select(UserKey).where(UserKey.user_id == trade.buyer_id).order_by(UserKey.created_at.desc()))
        buyer_key = buyer_key_any.scalars().first()

    # Fetch Seller key & user
    seller_user_res = await db.execute(select(User).where(User.id == trade.seller_id))
    seller_user = seller_user_res.scalar_one_or_none()
    seller_key_res = await db.execute(select(UserKey).where(UserKey.user_id == trade.seller_id, UserKey.is_active == True).order_by(UserKey.created_at.desc()))
    seller_key = seller_key_res.scalars().first()
    if not seller_key:
        seller_key_any = await db.execute(select(UserKey).where(UserKey.user_id == trade.seller_id).order_by(UserKey.created_at.desc()))
        seller_key = seller_key_any.scalars().first()

    buyer_verif = None
    if verification.buyer_signature_hex:
        valid_b = False
        matching_key = None
        if buyer_key and verify_ed25519_signature(buyer_key.public_key_hex, verification.trade_canonical_hash, verification.buyer_signature_hex):
            valid_b = True
            matching_key = buyer_key
        if not valid_b:
            all_b_keys = await db.execute(select(UserKey).where(UserKey.user_id == trade.buyer_id).order_by(UserKey.created_at.desc()))
            for k in all_b_keys.scalars().all():
                if verify_ed25519_signature(k.public_key_hex, verification.trade_canonical_hash, verification.buyer_signature_hex):
                    valid_b = True
                    matching_key = k
                    break
        pub_key = matching_key.public_key_hex if matching_key else (buyer_key.public_key_hex if buyer_key else "")
        buyer_verif = SignatureVerificationDetail(
            signer_id=trade.buyer_id,
            signer_name=buyer_user.full_name if buyer_user else "Buyer",
            role="buyer",
            public_key_hex=pub_key,
            signature_hex=verification.buyer_signature_hex,
            signed_at=verification.buyer_signed_at or trade.created_at,
            is_valid=valid_b
        )

    seller_verif = None
    if verification.seller_signature_hex:
        valid_s = False
        matching_key_s = None
        if seller_key and verify_ed25519_signature(seller_key.public_key_hex, verification.trade_canonical_hash, verification.seller_signature_hex):
            valid_s = True
            matching_key_s = seller_key
        if not valid_s:
            all_s_keys = await db.execute(select(UserKey).where(UserKey.user_id == trade.seller_id).order_by(UserKey.created_at.desc()))
            for k in all_s_keys.scalars().all():
                if verify_ed25519_signature(k.public_key_hex, verification.trade_canonical_hash, verification.seller_signature_hex):
                    valid_s = True
                    matching_key_s = k
                    break
        pub_key_s = matching_key_s.public_key_hex if matching_key_s else (seller_key.public_key_hex if seller_key else "")
        seller_verif = SignatureVerificationDetail(
            signer_id=trade.seller_id,
            signer_name=seller_user.full_name if seller_user else "Seller",
            role="seller",
            public_key_hex=pub_key_s,
            signature_hex=verification.seller_signature_hex,
            signed_at=verification.seller_signed_at or trade.created_at,
            is_valid=valid_s
        )

    return TradeVerificationResponse(
        trade_id=trade.id,
        verification_reference=verification.verification_reference,
        trade_canonical_hash=verification.trade_canonical_hash,
        canonical_payload=canonical_dict,
        canonical_trade_payload=canonical_dict,
        buyer_verification=buyer_verif,
        seller_verification=seller_verif,
        buyer_signature=verification.buyer_signature_hex,
        seller_signature=verification.seller_signature_hex,
        buyer_signed_at=verification.buyer_signed_at,
        seller_signed_at=verification.seller_signed_at,
        is_fully_verified=verification.is_fully_verified,
        audit_chain_previous_hash=verification.audit_chain_previous_hash,
        current_block_hash=verification.current_block_hash,
        verified_at=verification.verified_at,
        blockchain_status=getattr(verification, "blockchain_status", "unanchored") or "unanchored",
        blockchain_tx_hash=getattr(verification, "blockchain_tx_hash", None),
        blockchain_block_number=getattr(verification, "blockchain_block_number", None),
        blockchain_contract_address=getattr(verification, "blockchain_contract_address", None),
        blockchain_anchored_at=getattr(verification, "blockchain_anchored_at", None),
    )

async def check_and_finalize_dual_verification(trade: Trade, verification: TradeVerification, db: AsyncSession):
    """If both signatures are present, seal the verification block and audit chain."""
    if verification.buyer_signature_hex and verification.seller_signature_hex and not verification.is_fully_verified:
        now = datetime.now(timezone.utc)
        verification.is_fully_verified = True
        verification.verified_at = now
        trade.status = "fully_verified"

        # Link into persistent cryptographic audit-chain
        prev_block_res = await db.execute(
            select(TradeVerification)
            .where(TradeVerification.is_fully_verified == True, TradeVerification.id != verification.id)
            .order_by(desc(TradeVerification.verified_at))
        )
        prev_verif = prev_block_res.scalars().first()
        prev_hash = prev_verif.current_block_hash if prev_verif and prev_verif.current_block_hash else "0" * 64

        block_hash = compute_audit_block_hash(
            previous_hash=prev_hash,
            trade_canonical_hash=verification.trade_canonical_hash,
            buyer_signature_hex=verification.buyer_signature_hex,
            seller_signature_hex=verification.seller_signature_hex,
            verified_at=now
        )
        verification.audit_chain_previous_hash = prev_hash
        verification.current_block_hash = block_hash

        # Notify BOTH buyer and seller of full cryptographic seal
        await create_user_notification(
            db=db,
            user_id=trade.buyer_id,
            title="Trade Digitally Verified & Sealed",
            message="Both Ed25519 signatures were verified. The audit-chain proof has been sealed.",
            notif_type="trade_verified",
            reference_id=trade.id
        )
        await create_user_notification(
            db=db,
            user_id=trade.seller_id,
            title="Trade Digitally Verified & Sealed",
            message="Both Ed25519 signatures were verified. The audit-chain proof has been sealed.",
            notif_type="trade_verified",
            reference_id=trade.id
        )

@router.post("/keys/register")
async def register_public_key(
    key_in: KeyRegister,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Registers or updates the authenticated user's active Ed25519 public key."""
    existing_keys = await db.execute(
        select(UserKey).where(UserKey.user_id == current_user.id)
    )
    for key in existing_keys.scalars().all():
        key.is_active = False

    new_key = UserKey(
        user_id=current_user.id,
        public_key_hex=key_in.public_key_hex,
        algorithm=key_in.algorithm or "Ed25519",
        is_active=True
    )
    db.add(new_key)
    await db.commit()
    return {"message": "Public key successfully registered and active.", "public_key_hex": key_in.public_key_hex}

@router.post("/trades/{trade_id}/buyer-sign", response_model=TradeVerificationResponse)
async def buyer_sign_trade(
    trade_id: UUID,
    req: BuyerSignRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Submits and cryptographically verifies the buyer's digital signature for a trade.
    Only the authorized buyer of this trade can sign.
    """
    trade_res = await db.execute(select(Trade).where(Trade.id == trade_id))
    trade = trade_res.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found.")

    if current_user.id != trade.buyer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only the authenticated buyer can submit a buyer signature for this trade."
        )

    verification = await get_or_create_verification(trade, db)

    # Fetch or auto-register Buyer's registered Ed25519 public key
    key_res = await db.execute(
        select(UserKey).where(
            UserKey.user_id == current_user.id,
            UserKey.is_active == True
        ).order_by(UserKey.created_at.desc())
    )
    buyer_key = key_res.scalars().first()
    if req.public_key_hex and (not buyer_key or buyer_key.public_key_hex != req.public_key_hex):
        if buyer_key:
            buyer_key.is_active = False
        buyer_key = UserKey(
            user_id=current_user.id,
            public_key_hex=req.public_key_hex,
            algorithm="Ed25519",
            is_active=True
        )
        db.add(buyer_key)
        await db.flush()

    if not buyer_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Buyer does not have an active registered Ed25519 public key. Please register your public key first."
        )

    # Verify signature
    is_valid = verify_ed25519_signature(
        public_key_hex=buyer_key.public_key_hex,
        payload_hash_hex=verification.trade_canonical_hash,
        signature_hex=req.signature_hex
    )
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cryptographic verification failed: Signature does not match the canonical trade hash and buyer public key."
        )

    now = datetime.now(timezone.utc)
    verification.buyer_signature_hex = req.signature_hex
    verification.buyer_signed_at = now

    if trade.status in ["matched", "pending_signatures"]:
        trade.status = "buyer_signed"

    # Notify Seller and Buyer
    await create_user_notification(
        db=db,
        user_id=trade.seller_id,
        title="Buyer Signed Trade",
        message=f"Buyer {current_user.full_name} completed the Ed25519 signature. Your countersignature is now required.",
        notif_type="buyer_signed",
        reference_id=trade.id
    )
    await create_user_notification(
        db=db,
        user_id=current_user.id,
        title="Signature Verified",
        message="Your Ed25519 signature for this trade was verified successfully.",
        notif_type="signature_verified",
        reference_id=trade.id
    )

    await check_and_finalize_dual_verification(trade, verification, db)

    await db.commit()
    await db.refresh(verification)
    await db.refresh(trade)

    return await build_verification_response(trade, verification, db)

@router.post("/trades/{trade_id}/seller-sign", response_model=TradeVerificationResponse)
async def seller_sign_trade(
    trade_id: UUID,
    req: SellerSignRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Submits and cryptographically verifies the seller's digital signature for a trade.
    Only the authorized seller of this trade can sign.
    """
    trade_res = await db.execute(select(Trade).where(Trade.id == trade_id))
    trade = trade_res.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found.")

    if current_user.id != trade.seller_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only the authenticated seller can submit a seller signature for this trade."
        )

    verification = await get_or_create_verification(trade, db)

    # Fetch or auto-register Seller's registered Ed25519 public key
    key_res = await db.execute(
        select(UserKey).where(
            UserKey.user_id == current_user.id,
            UserKey.is_active == True
        ).order_by(UserKey.created_at.desc())
    )
    seller_key = key_res.scalars().first()
    if req.public_key_hex and (not seller_key or seller_key.public_key_hex != req.public_key_hex):
        if seller_key:
            seller_key.is_active = False
        seller_key = UserKey(
            user_id=current_user.id,
            public_key_hex=req.public_key_hex,
            algorithm="Ed25519",
            is_active=True
        )
        db.add(seller_key)
        await db.flush()

    if not seller_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seller does not have an active registered Ed25519 public key. Please register your public key first."
        )

    # Verify signature
    is_valid = verify_ed25519_signature(
        public_key_hex=seller_key.public_key_hex,
        payload_hash_hex=verification.trade_canonical_hash,
        signature_hex=req.signature_hex
    )
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cryptographic verification failed: Signature does not match the canonical trade hash and seller public key."
        )

    now = datetime.now(timezone.utc)
    verification.seller_signature_hex = req.signature_hex
    verification.seller_signed_at = now

    if trade.status in ["matched", "pending_signatures"]:
        trade.status = "seller_signed"

    # Notify Buyer and Seller
    await create_user_notification(
        db=db,
        user_id=trade.buyer_id,
        title="Seller Countersigned Trade",
        message=f"Seller {current_user.full_name} signed the trade. Dual verification is proceeding.",
        notif_type="seller_signed",
        reference_id=trade.id
    )
    await create_user_notification(
        db=db,
        user_id=current_user.id,
        title="Signature Verified",
        message="Your Ed25519 signature for this trade was verified successfully.",
        notif_type="signature_verified",
        reference_id=trade.id
    )

    await check_and_finalize_dual_verification(trade, verification, db)

    await db.commit()
    await db.refresh(verification)
    await db.refresh(trade)

    return await build_verification_response(trade, verification, db)

@router.get("/trades/{trade_id}", response_model=TradeVerificationResponse)
async def get_trade_verification_by_trade_id(
    trade_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves the cryptographic verification record and dual signatures for a trade.
    Authorized for trade participants (buyer/seller) or admins.
    """
    trade_res = await db.execute(select(Trade).where(Trade.id == trade_id))
    trade = trade_res.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found.")

    user_role = (current_user.role or "").lower()
    if current_user.id not in [trade.buyer_id, trade.seller_id] and user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to inspect cryptographic proof for this private trade."
        )

    verification = await get_or_create_verification(trade, db)
    await db.commit()
    return await build_verification_response(trade, verification, db)

@router.get("/receipts/{verification_reference}", response_model=TradeVerificationResponse)
async def get_verification_by_reference(
    verification_reference: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Public receipt inspector endpoint to lookup verified trade by reference code (P2P-VRF-...).
    """
    verif_res = await db.execute(select(TradeVerification).where(TradeVerification.verification_reference == verification_reference))
    verification = verif_res.scalar_one_or_none()
    if not verification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Verification receipt '{verification_reference}' not found.")

    trade_res = await db.execute(select(Trade).where(Trade.id == verification.trade_id))
    trade = trade_res.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated trade not found.")

    return await build_verification_response(trade, verification, db)

@router.post("/verify", response_model=TamperVerifyResponse)
async def verify_trade_integrity(
    req: TamperVerifyRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Cryptographic Tamper-Detection Engine:
    Independently recomputes the canonical payload and SHA-256 hash,
    and re-verifies signatures and audit chain link against authoritative data.
    """
    trade_res = await db.execute(select(Trade).where(Trade.id == req.trade_id))
    trade = trade_res.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found.")

    verif_res = await db.execute(select(TradeVerification).where(TradeVerification.trade_id == req.trade_id))
    verification = verif_res.scalar_one_or_none()
    if not verification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification record not found.")

    # Compute hash from authoritative DB payload or tampered payload (sandbox test)
    if req.tampered_payload:
        computed_hash = compute_sha256_hash(req.tampered_payload)
    else:
        auth_payload = build_canonical_trade_payload(
            trade_id=str(trade.id),
            buyer_id=str(trade.buyer_id),
            seller_id=str(trade.seller_id),
            listing_id=str(trade.listing_id),
            energy_kwh=float(trade.energy_amount_kwh),
            unit_price=float(trade.unit_price),
            total_amount=float(trade.total_amount),
            currency="INR",
            delivery_start=trade.delivery_start,
            delivery_end=trade.delivery_end
        )
        computed_hash = compute_sha256_hash(auth_payload)

    # 1. Check Hash Equality
    if not req.tampered_payload and verification.trade_canonical_hash != computed_hash and not verification.is_fully_verified:
        verification.trade_canonical_hash = computed_hash
        await db.commit()

    hash_valid = (computed_hash == verification.trade_canonical_hash)

    # 2. Check Buyer Signature
    buyer_sig_valid = False
    if verification.buyer_signature_hex:
        b_keys_res = await db.execute(select(UserKey).where(UserKey.user_id == trade.buyer_id).order_by(UserKey.is_active.desc(), UserKey.created_at.desc()))
        for b_key in b_keys_res.scalars().all():
            if verify_ed25519_signature(
                public_key_hex=b_key.public_key_hex,
                payload_hash_hex=computed_hash,
                signature_hex=verification.buyer_signature_hex
            ):
                buyer_sig_valid = True
                break

    # 3. Check Seller Signature
    seller_sig_valid = False
    if verification.seller_signature_hex:
        s_keys_res = await db.execute(select(UserKey).where(UserKey.user_id == trade.seller_id).order_by(UserKey.is_active.desc(), UserKey.created_at.desc()))
        for s_key in s_keys_res.scalars().all():
            if verify_ed25519_signature(
                public_key_hex=s_key.public_key_hex,
                payload_hash_hex=computed_hash,
                signature_hex=verification.seller_signature_hex
            ):
                seller_sig_valid = True
                break

    # 4. Check Audit Chain Block Hash
    audit_chain_valid = False
    if verification.is_fully_verified and verification.current_block_hash and verification.verified_at:
        expected_block_hash = compute_audit_block_hash(
            previous_hash=verification.audit_chain_previous_hash or "0" * 64,
            trade_canonical_hash=computed_hash,
            buyer_signature_hex=verification.buyer_signature_hex,
            seller_signature_hex=verification.seller_signature_hex,
            verified_at=verification.verified_at
        )
        audit_chain_valid = (expected_block_hash == verification.current_block_hash)
    elif not verification.is_fully_verified:
        audit_chain_valid = True  # Pending verification

    overall_verified = bool(
        hash_valid and
        (buyer_sig_valid if verification.buyer_signature_hex else True) and
        (seller_sig_valid if verification.seller_signature_hex else True) and
        (audit_chain_valid if verification.is_fully_verified else True)
    )

    if overall_verified:
        if verification.is_fully_verified:
            details = "Trade authenticity cryptographically verified. Canonical hash, Ed25519 signatures, and audit block match."
        else:
            details = "Trade payload integrity cryptographically verified. Canonical SHA-256 hash matches commitment."
    else:
        failed_reasons = []
        if not hash_valid:
            failed_reasons.append("Payload altered: SHA-256 hash does not match canonical commitment.")
        if verification.buyer_signature_hex and not buyer_sig_valid:
            failed_reasons.append("Buyer signature verification failed against registered Ed25519 public key.")
        if verification.seller_signature_hex and not seller_sig_valid:
            failed_reasons.append("Seller signature verification failed against registered Ed25519 public key.")
        if verification.is_fully_verified and not audit_chain_valid:
            failed_reasons.append("Audit chain block hash corrupted or tampered.")
        details = " | ".join(failed_reasons) if failed_reasons else "Integrity verification failed."

    # 5. Check Blockchain Anchor if anchored
    blockchain_valid = None
    on_chain_hash = None
    if blockchain_service.is_connected() and getattr(verification, "blockchain_status", None) == "anchored":
        on_chain_deal = blockchain_service.get_deal(str(trade.id))
        if on_chain_deal:
            on_chain_hash = on_chain_deal.get("trade_canonical_hash")
            blockchain_valid = blockchain_service.verify_deal_hash(str(trade.id), computed_hash)
            if not blockchain_valid:
                overall_verified = False
                failed_reasons = [] if hash_valid else ["Payload altered: SHA-256 hash does not match canonical commitment."]
                failed_reasons.append("Blockchain anchor mismatch: On-chain immutable commitment does not match payload hash.")
                details = " | ".join(failed_reasons)

    return TamperVerifyResponse(
        verified=overall_verified,
        hash_valid=hash_valid,
        buyer_signature_valid=buyer_sig_valid,
        seller_signature_valid=seller_sig_valid,
        audit_chain_valid=audit_chain_valid,
        trade_id=trade.id,
        verification_reference=verification.verification_reference,
        computed_hash=computed_hash,
        stored_hash=verification.trade_canonical_hash,
        details=details,
        blockchain_status=getattr(verification, "blockchain_status", "unanchored") or "unanchored",
        blockchain_verified=blockchain_valid,
        on_chain_hash=on_chain_hash
    )

@router.post("/trades/{trade_id}/anchor", response_model=BlockchainProofResponse)
async def anchor_trade_to_blockchain(
    trade_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Anchors a fully verified trade onto the EnergyDealRegistry smart contract.
    Guarantees:
    1. Only trade participants (buyer/seller) or admin can invoke.
    2. Only dual-signed, fully_verified trades are anchored.
    3. Idempotent: returns existing proof if already anchored.
    4. Milestone 5 verification is NEVER invalidated if blockchain RPC is down.
    """
    trade_res = await db.execute(select(Trade).where(Trade.id == trade_id))
    trade = trade_res.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found.")

    user_role = (current_user.role or "").lower()
    if current_user.id not in [trade.buyer_id, trade.seller_id] and user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Not authorized to anchor this trade."
        )

    verif_res = await db.execute(select(TradeVerification).where(TradeVerification.trade_id == trade_id))
    verification = verif_res.scalar_one_or_none()
    if not verification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade verification record not found.")

    if not verification.is_fully_verified or trade.status != "fully_verified":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot anchor trade: Trade is not fully verified. Both buyer and seller must complete Ed25519 signatures first."
        )

    # 1. Idempotency check in database
    if verification.blockchain_status == "anchored" and verification.blockchain_tx_hash:
        on_chain_deal = blockchain_service.get_deal(str(trade.id)) if blockchain_service.is_connected() else None
        return BlockchainProofResponse(
            trade_id=trade.id,
            verification_reference=verification.verification_reference,
            trade_canonical_hash=verification.trade_canonical_hash,
            blockchain_status=verification.blockchain_status,
            blockchain_tx_hash=verification.blockchain_tx_hash,
            blockchain_block_number=verification.blockchain_block_number,
            blockchain_contract_address=verification.blockchain_contract_address,
            blockchain_anchored_at=verification.blockchain_anchored_at,
            is_on_chain_verified=True,
            on_chain_deal=on_chain_deal,
            message="Trade is already anchored on-chain."
        )

    # 2. Attempt blockchain anchoring via blockchain_service
    try:
        anchor_res = blockchain_service.anchor_trade(
            trade_id=str(trade.id),
            verification_reference=verification.verification_reference,
            canonical_hash_hex=verification.trade_canonical_hash,
            energy_kwh=float(trade.energy_amount_kwh),
            total_amount=float(trade.total_amount)
        )

        verification.blockchain_status = "anchored"
        if anchor_res.get("blockchain_tx_hash"):
            verification.blockchain_tx_hash = anchor_res["blockchain_tx_hash"]
        if anchor_res.get("blockchain_block_number"):
            verification.blockchain_block_number = anchor_res["blockchain_block_number"]
        if anchor_res.get("blockchain_contract_address"):
            verification.blockchain_contract_address = anchor_res["blockchain_contract_address"]
        if anchor_res.get("blockchain_anchored_at"):
            verification.blockchain_anchored_at = anchor_res["blockchain_anchored_at"]

        # Notify BOTH Buyer and Seller of confirmed blockchain anchor
        trade_prefix = str(trade.id)[:8]
        await create_user_notification(
            db=db,
            user_id=trade.buyer_id,
            title="Blockchain Anchor Confirmed",
            message=f"Trade {trade_prefix} was immutably anchored on the EnergyDealRegistry.",
            notif_type="blockchain_anchored",
            reference_id=trade.id
        )
        await create_user_notification(
            db=db,
            user_id=trade.seller_id,
            title="Blockchain Anchor Confirmed",
            message=f"Trade {trade_prefix} was immutably anchored on the EnergyDealRegistry.",
            notif_type="blockchain_anchored",
            reference_id=trade.id
        )

        await db.commit()
        await db.refresh(verification)

        on_chain_deal = blockchain_service.get_deal(str(trade.id))

        return BlockchainProofResponse(
            trade_id=trade.id,
            verification_reference=verification.verification_reference,
            trade_canonical_hash=verification.trade_canonical_hash,
            blockchain_status=verification.blockchain_status,
            blockchain_tx_hash=verification.blockchain_tx_hash,
            blockchain_block_number=verification.blockchain_block_number,
            blockchain_contract_address=verification.blockchain_contract_address,
            blockchain_anchored_at=verification.blockchain_anchored_at,
            is_on_chain_verified=True,
            on_chain_deal=on_chain_deal,
            message="Trade successfully anchored on EnergyDealRegistry."
        )
    except BlockchainServiceError as e:
        # Graceful failure handling: Do NOT invalidate Milestone 5 trade verification
        verification.blockchain_status = "failed"
        await create_user_notification(
            db=db,
            user_id=current_user.id,
            title="Blockchain Anchor Notice",
            message="On-chain anchoring encountered an RPC delay or failure. Off-chain digital verification remains valid.",
            notif_type="blockchain_anchor_failed",
            reference_id=trade.id
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Blockchain anchoring failed: {str(e)}. Trade remains fully verified in Milestone 5 audit ledger."
        )
    except Exception as e:
        verification.blockchain_status = "failed"
        await create_user_notification(
            db=db,
            user_id=current_user.id,
            title="Blockchain Anchor Notice",
            message="On-chain anchoring encountered an RPC delay or failure. Off-chain digital verification remains valid.",
            notif_type="blockchain_anchor_failed",
            reference_id=trade.id
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error during blockchain anchoring: {str(e)}"
        )

@router.get("/trades/{trade_id}/blockchain-proof", response_model=BlockchainProofResponse)
async def get_blockchain_proof(
    trade_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves the blockchain anchoring status and on-chain verification proof for a trade.
    """
    trade_res = await db.execute(select(Trade).where(Trade.id == trade_id))
    trade = trade_res.scalar_one_or_none()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found.")

    user_role = (current_user.role or "").lower()
    if current_user.id not in [trade.buyer_id, trade.seller_id] and user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Not authorized to view proof for this trade."
        )

    verif_res = await db.execute(select(TradeVerification).where(TradeVerification.trade_id == trade_id))
    verification = verif_res.scalar_one_or_none()
    if not verification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification record not found.")

    # Check on-chain state if connected
    on_chain_deal = None
    is_on_chain_valid = None

    if blockchain_service.is_connected():
        on_chain_deal = blockchain_service.get_deal(str(trade.id))
        if on_chain_deal:
            is_on_chain_valid = blockchain_service.verify_deal_hash(
                str(trade.id),
                verification.trade_canonical_hash
            )
            # Reconcile DB if blockchain is registered but DB was unanchored
            if verification.blockchain_status != "anchored":
                verification.blockchain_status = "anchored"
                verification.blockchain_anchored_at = on_chain_deal.get("anchored_at")
                verification.blockchain_contract_address = blockchain_service.contract_address_raw
                await db.commit()

    return BlockchainProofResponse(
        trade_id=trade.id,
        verification_reference=verification.verification_reference,
        trade_canonical_hash=verification.trade_canonical_hash,
        blockchain_status=verification.blockchain_status or "unanchored",
        blockchain_tx_hash=verification.blockchain_tx_hash,
        blockchain_block_number=verification.blockchain_block_number,
        blockchain_contract_address=verification.blockchain_contract_address,
        blockchain_anchored_at=verification.blockchain_anchored_at,
        is_on_chain_verified=is_on_chain_valid,
        on_chain_deal=on_chain_deal,
        message="Blockchain proof retrieved successfully."
    )

@router.post("/sign", response_model=TradeVerificationResponse)
async def sign_trade_generic(
    req: TradeSignRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Backwards-compatible generic signing endpoint delegating to role-based verification.
    """
    if req.signer_role.lower() == "buyer":
        return await buyer_sign_trade(req.trade_id, BuyerSignRequest(signature_hex=req.signature_hex), current_user, db)
    elif req.signer_role.lower() == "seller":
        return await seller_sign_trade(req.trade_id, SellerSignRequest(signature_hex=req.signature_hex), current_user, db)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signer_role. Must be 'buyer' or 'seller'.")

@router.get("/verify/{trade_id}", response_model=TradeVerificationResponse)
async def get_trade_verification_details_alias(
    trade_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Backwards-compatible alias for /trades/{trade_id}."""
    return await get_trade_verification_by_trade_id(trade_id, current_user, db)

@router.get("/audit-chain", response_model=List[ProofChainBlock])
async def get_public_audit_chain(db: AsyncSession = Depends(get_db)):
    """Returns verified blocks in the tamper-evident cryptographic trade audit chain."""
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


