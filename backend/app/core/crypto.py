import hashlib
import json
from typing import Dict, Any
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.exceptions import InvalidSignature

def canonicalize_payload(payload: Dict[str, Any]) -> str:
    """
    Produce a deterministic, whitespace-normalized JSON representation for hashing.
    """
    return json.dumps(payload, sort_keys=True, separators=(',', ':'))

def compute_sha256_hash(payload: Dict[str, Any]) -> str:
    """
    Computes hex-encoded SHA-256 hash of the canonical JSON string.
    """
    canonical_str = canonicalize_payload(payload)
    return hashlib.sha256(canonical_str.encode('utf-8')).hexdigest()

def generate_ed25519_keypair() -> tuple[str, str]:
    """
    Generates a new Ed25519 private/public keypair in hex format.
    Useful for testing, CLI seeders, or backend demo key generators.
    """
    private_key = ed25519.Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    
    priv_hex = private_key.private_bytes_raw().hex()
    pub_hex = public_key.public_bytes_raw().hex()
    return priv_hex, pub_hex

def sign_payload_ed25519(private_key_hex: str, payload_hash_hex: str) -> str:
    """
    Signs the SHA-256 payload hash with the private key.
    """
    private_key_bytes = bytes.fromhex(private_key_hex)
    private_key = ed25519.Ed25519PrivateKey.from_private_bytes(private_key_bytes)
    signature = private_key.sign(bytes.fromhex(payload_hash_hex))
    return signature.hex()

def verify_ed25519_signature(public_key_hex: str, payload_hash_hex: str, signature_hex: str) -> bool:
    """
    Cryptographically verifies that the signature matches the payload hash and public key.
    """
    try:
        public_key_bytes = bytes.fromhex(public_key_hex)
        public_key = ed25519.Ed25519PublicKey.from_public_bytes(public_key_bytes)
        
        signature_bytes = bytes.fromhex(signature_hex)
        message_bytes = bytes.fromhex(payload_hash_hex)
        
        public_key.verify(signature_bytes, message_bytes)
        return True
    except (InvalidSignature, ValueError, Exception):
        return False
