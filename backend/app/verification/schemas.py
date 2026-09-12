from pydantic import BaseModel, Field, model_validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID

class BuyerSignRequest(BaseModel):
    signature_hex: Optional[str] = Field(default=None, description="Ed25519 signature of the trade canonical hash in hex (128 chars)")
    signature: Optional[str] = None
    public_key_hex: Optional[str] = None
    public_key: Optional[str] = None

    @model_validator(mode="after")
    def resolve_fields(self):
        sig = self.signature_hex or self.signature
        if not sig:
            raise ValueError("signature_hex or signature is required")
        self.signature_hex = sig
        pk = self.public_key_hex or self.public_key
        if pk:
            self.public_key_hex = pk
        return self

class SellerSignRequest(BaseModel):
    signature_hex: Optional[str] = Field(default=None, description="Ed25519 signature of the trade canonical hash in hex (128 chars)")
    signature: Optional[str] = None
    public_key_hex: Optional[str] = None
    public_key: Optional[str] = None

    @model_validator(mode="after")
    def resolve_fields(self):
        sig = self.signature_hex or self.signature
        if not sig:
            raise ValueError("signature_hex or signature is required")
        self.signature_hex = sig
        pk = self.public_key_hex or self.public_key
        if pk:
            self.public_key_hex = pk
        return self

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
    canonical_trade_payload: Optional[Dict[str, Any]] = None
    buyer_verification: Optional[SignatureVerificationDetail] = None
    seller_verification: Optional[SignatureVerificationDetail] = None
    buyer_signature: Optional[str] = None
    seller_signature: Optional[str] = None
    buyer_signed_at: Optional[datetime] = None
    seller_signed_at: Optional[datetime] = None
    is_fully_verified: bool
    audit_chain_previous_hash: Optional[str] = None
    current_block_hash: Optional[str] = None
    verified_at: Optional[datetime] = None
    # Blockchain Anchor Metadata (Milestone 6)
    blockchain_status: Optional[str] = "unanchored"
    blockchain_tx_hash: Optional[str] = None
    blockchain_block_number: Optional[int] = None
    blockchain_contract_address: Optional[str] = None
    blockchain_anchored_at: Optional[datetime] = None

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

class TamperVerifyRequest(BaseModel):
    trade_id: UUID
    tampered_payload: Optional[Dict[str, Any]] = Field(default=None, description="Optional modified payload to test tamper detection")
    canonical_trade_payload: Optional[Dict[str, Any]] = Field(default=None, description="Alternative key for modified payload")

    @model_validator(mode="after")
    def resolve_payload(self):
        if not self.tampered_payload and self.canonical_trade_payload:
            self.tampered_payload = self.canonical_trade_payload
        return self

class TamperVerifyResponse(BaseModel):
    verified: bool
    hash_valid: bool
    buyer_signature_valid: bool
    seller_signature_valid: bool
    audit_chain_valid: bool
    trade_id: UUID
    verification_reference: Optional[str] = None
    computed_hash: str
    stored_hash: str
    details: str
    # Blockchain Anchor Verification (Milestone 6)
    blockchain_status: Optional[str] = None
    blockchain_verified: Optional[bool] = None
    on_chain_hash: Optional[str] = None

class BlockchainProofResponse(BaseModel):
    trade_id: UUID
    verification_reference: str
    trade_canonical_hash: str
    blockchain_status: str  # "unanchored", "pending", "anchored", "failed"
    blockchain_tx_hash: Optional[str] = None
    blockchain_block_number: Optional[int] = None
    blockchain_contract_address: Optional[str] = None
    blockchain_anchored_at: Optional[datetime] = None
    is_on_chain_verified: Optional[bool] = None
    on_chain_deal: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
