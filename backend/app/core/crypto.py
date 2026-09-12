import hashlib
import json
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.exceptions import InvalidSignature

def canonicalize_payload(payload: Dict[str, Any]) -> str:
    """
    Produce a deterministic, RFC 8785 whitespace-normalized JSON representation for hashing.
    Keys are sorted alphabetically, no trailing whitespace, UTF-8 compatible.
    """
    return json.dumps(payload, sort_keys=True, separators=(',', ':'))

def build_canonical_trade_payload(
    trade_id: str,
    buyer_id: str,
    seller_id: str,
    listing_id: str,
    energy_kwh: float,
    unit_price: float,
    total_amount: float,
    currency: str = "INR",
    delivery_window: Optional[str] = None,
    delivery_start: Optional[datetime] = None,
    delivery_end: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Constructs the authoritative canonical trade metadata dictionary.
    Guarantees deterministic numeric precision and formatted delivery window.
    """
    if not delivery_window:
        if delivery_start and delivery_end:
            start_iso = delivery_start.astimezone(timezone.utc).isoformat() if delivery_start.tzinfo else delivery_start.isoformat()
            end_iso = delivery_end.astimezone(timezone.utc).isoformat() if delivery_end.tzinfo else delivery_end.isoformat()
            delivery_window = f"{start_iso}_to_{end_iso}"
        else:
            delivery_window = "WINDOW_UNSPECIFIED"

    return {
        "trade_id": str(trade_id),
        "buyer_id": str(buyer_id),
        "seller_id": str(seller_id),
        "listing_id": str(listing_id),
        "energy_kwh": round(float(energy_kwh), 2),
        "unit_price": round(float(unit_price), 4),
        "total_amount": round(float(total_amount), 4),
        "currency": str(currency),
        "delivery_window": str(delivery_window)
    }

def compute_sha256_hash(payload: Dict[str, Any]) -> str:
    """
    Computes hex-encoded SHA-256 hash of the canonical JSON string.
    Returns exactly 64 hexadecimal characters.
    """
    canonical_str = canonicalize_payload(payload)
    return hashlib.sha256(canonical_str.encode('utf-8')).hexdigest()

def compute_audit_block_hash(
    previous_hash: str,
    trade_canonical_hash: str,
    buyer_signature_hex: str,
    seller_signature_hex: str,
    verified_at: datetime
) -> str:
    """
    Computes the cryptographic block hash linking this verified trade to the audit chain.
    """
    timestamp_iso = verified_at.astimezone(timezone.utc).isoformat() if verified_at.tzinfo else verified_at.isoformat()
    raw_block = f"{previous_hash}:{trade_canonical_hash}:{buyer_signature_hex}:{seller_signature_hex}:{timestamp_iso}"
    return hashlib.sha256(raw_block.encode('utf-8')).hexdigest()

def generate_ed25519_keypair() -> tuple[str, str]:
    """
    Generates a new Ed25519 private/public keypair in hex format.
    Private key: 32 bytes (64 hex characters)
    Public key: 32 bytes (64 hex characters)
    """
    private_key = ed25519.Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    
    priv_hex = private_key.private_bytes_raw().hex()
    pub_hex = public_key.public_bytes_raw().hex()
    return priv_hex, pub_hex

def sign_payload_ed25519(private_key_hex: str, payload_hash_hex: str) -> str:
    """
    Signs the SHA-256 payload hash (32 bytes) with the Ed25519 private key.
    Returns 64 bytes (128 hex characters) signature.
    """
    private_key_bytes = bytes.fromhex(private_key_hex)
    private_key = ed25519.Ed25519PrivateKey.from_private_bytes(private_key_bytes)
    message_bytes = bytes.fromhex(payload_hash_hex)
    signature = private_key.sign(message_bytes)
    return signature.hex()

def verify_ed25519_signature(public_key_hex: str, payload_hash_hex: str, signature_hex: str) -> bool:
    """
    Cryptographically verifies that the Ed25519 signature matches the payload hash and public key.
    """
    try:
        public_key_bytes = bytes.fromhex(public_key_hex)
        public_key = ed25519.Ed25519PublicKey.from_public_bytes(public_key_bytes)
        
        signature_bytes = bytes.fromhex(signature_hex)
        message_bytes = bytes.fromhex(payload_hash_hex)
        
        public_key.verify(signature_bytes, message_bytes)
        return True
    except (InvalidSignature, ValueError, TypeError, Exception):
        return False

