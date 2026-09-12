from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID

class TradeSignRequest(BaseModel):
    trade_id: UUID
    signature_hex: str
    signer_role: str  # 'buyer' or 'seller'

class SignatureVerificationDetail(BaseModel):
    signer_id: UUID
    signer_name: str
    role: str
    public_key_hex: str
    signature_hex: str
    signed_at: datetime
    is_valid: bool

class TradeVerificationResponse(BaseModel):
    trade_id: UUID
    verification_reference: str
    trade_canonical_hash: str
    canonical_payload: Dict[str, Any]
    buyer_verification: Optional[SignatureVerificationDetail] = None
    seller_verification: Optional[SignatureVerificationDetail] = None
    is_fully_verified: bool
    audit_chain_previous_hash: Optional[str] = None
    current_block_hash: Optional[str] = None
    verified_at: Optional[datetime] = None

class ProofChainBlock(BaseModel):
    block_index: int
    trade_id: UUID
    verification_reference: str
    trade_canonical_hash: str
    buyer_signature_short: str
    seller_signature_short: str
    previous_hash: str
    current_hash: str
    timestamp: datetime
