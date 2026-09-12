import json
import os
import re
from decimal import Decimal
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any

from web3 import Web3
from eth_account import Account
from hexbytes import HexBytes

from app.config import settings

class BlockchainServiceError(Exception):
    """Base exception for blockchain service errors."""
    pass

class BlockchainConnectionError(BlockchainServiceError):
    """Raised when unable to connect to the Ethereum RPC node."""
    pass

class BlockchainContractError(BlockchainServiceError):
    """Raised when contract interaction fails or reverts."""
    pass

class BlockchainService:
    """
    Isolated service handling Ethereum/EVM communication for the EnergyDealRegistry contract.
    Responsible for anchoring verified SHA-256 trade hashes and retrieving immutable proof metadata.
    """
    SCALE_FACTOR: int = 100

    def __init__(self):
        self.rpc_url = settings.BLOCKCHAIN_RPC_URL
        self.chain_id = settings.BLOCKCHAIN_CHAIN_ID
        self.contract_address_raw = settings.ENERGY_DEAL_REGISTRY_ADDRESS
        self.private_key = settings.BLOCKCHAIN_PRIVATE_KEY
        self._w3: Optional[Web3] = None
        self._contract = None
        self._abi = None

    def get_w3(self) -> Web3:
        """Initializes and returns the Web3 instance."""
        if self._w3 is None:
            self._w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        return self._w3

    def get_abi(self) -> list:
        """Locates and loads the EnergyDealRegistry ABI from the compiled Hardhat artifact."""
        if self._abi is not None:
            return self._abi

        # Search multiple candidate paths relative to this file and workspace root
        current_file = Path(__file__).resolve()
        candidate_paths = [
            # 1. Root relative from app/verification/blockchain_service.py (3 levels up)
            current_file.parents[3] / "blockchain" / "artifacts" / "contracts" / "EnergyDealRegistry.sol" / "EnergyDealRegistry.json",
            # 2. Process CWD relative
            Path.cwd() / "blockchain" / "artifacts" / "contracts" / "EnergyDealRegistry.sol" / "EnergyDealRegistry.json",
            Path.cwd() / ".." / "blockchain" / "artifacts" / "contracts" / "EnergyDealRegistry.sol" / "EnergyDealRegistry.json",
        ]

        for p in candidate_paths:
            if p.exists():
                with open(p, "r", encoding="utf-8") as f:
                    artifact = json.load(f)
                    self._abi = artifact.get("abi", [])
                    return self._abi

        # Fallback minimal ABI if artifact file cannot be read from filesystem
        self._abi = [
            {
                "inputs": [
                    {"internalType": "string", "name": "tradeId", "type": "string"},
                    {"internalType": "string", "name": "verificationReference", "type": "string"},
                    {"internalType": "bytes32", "name": "tradeCanonicalHash", "type": "bytes32"},
                    {"internalType": "uint256", "name": "energyAmountKwhScaled", "type": "uint256"},
                    {"internalType": "uint256", "name": "totalAmountScaled", "type": "uint256"}
                ],
                "name": "registerDeal",
                "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "string", "name": "tradeId", "type": "string"}],
                "name": "getDeal",
                "outputs": [
                    {
                        "components": [
                            {"internalType": "string", "name": "tradeId", "type": "string"},
                            {"internalType": "string", "name": "verificationReference", "type": "string"},
                            {"internalType": "bytes32", "name": "tradeCanonicalHash", "type": "bytes32"},
                            {"internalType": "uint256", "name": "energyAmountKwhScaled", "type": "uint256"},
                            {"internalType": "uint256", "name": "totalAmountScaled", "type": "uint256"},
                            {"internalType": "uint256", "name": "anchoredAt", "type": "uint256"},
                            {"internalType": "address", "name": "anchoredBy", "type": "address"}
                        ],
                        "internalType": "struct EnergyDealRegistry.EnergyDeal",
                        "name": "",
                        "type": "tuple"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "string", "name": "tradeId", "type": "string"}],
                "name": "isDealRegistered",
                "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {"internalType": "string", "name": "tradeId", "type": "string"},
                    {"internalType": "bytes32", "name": "tradeCanonicalHash", "type": "bytes32"}
                ],
                "name": "verifyDealHash",
                "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
                "stateMutability": "view",
                "type": "function"
            }
        ]
        return self._abi

    def get_contract(self):
        """Returns the initialized Web3 Contract instance."""
        if self._contract is not None:
            return self._contract

        w3 = self.get_w3()
        if not Web3.is_address(self.contract_address_raw):
            raise BlockchainContractError(f"Invalid Ethereum contract address configured: {self.contract_address_raw}")

        checksum_addr = Web3.to_checksum_address(self.contract_address_raw)
        abi = self.get_abi()
        self._contract = w3.eth.contract(address=checksum_addr, abi=abi)
        return self._contract

    def is_connected(self) -> bool:
        """Checks if the Ethereum RPC node is reachable."""
        try:
            w3 = self.get_w3()
            return bool(w3.is_connected())
        except Exception:
            return False

    def validate_connection_and_chain(self):
        """Validates that the RPC node is connected and running the expected Chain ID."""
        w3 = self.get_w3()
        if not w3.is_connected():
            raise BlockchainConnectionError(f"Cannot connect to Ethereum RPC endpoint at {self.rpc_url}")
        
        actual_chain_id = w3.eth.chain_id
        if actual_chain_id != self.chain_id:
            raise BlockchainConnectionError(
                f"Connected chain ID ({actual_chain_id}) does not match configured chain ID ({self.chain_id})"
            )

    @staticmethod
    def format_hash_to_bytes32(hash_hex: str) -> bytes:
        """
        Converts a 64-character hexadecimal SHA-256 hash string into a 32-byte bytes32 format.
        Validates that the input is exactly 64 hexadecimal characters.
        """
        clean = hash_hex.strip()
        if clean.startswith("0x") or clean.startswith("0X"):
            clean = clean[2:]

        if len(clean) != 64 or not re.fullmatch(r"^[0-9a-fA-F]{64}$", clean):
            raise ValueError(f"Invalid SHA-256 hash format: expected 64 hex characters, got '{hash_hex}'")

        return bytes.fromhex(clean)

    @staticmethod
    def scale_numeric_value(value: float | int | Decimal) -> int:
        """
        Deterministically scales a decimal quantity by SCALE_FACTOR (100) to avoid floating-point loss.
        Examples:
          25.50 kWh -> 2550
          145.00 INR -> 14500
        """
        dec = Decimal(str(value))
        scaled = dec * Decimal(BlockchainService.SCALE_FACTOR)
        return int(scaled.quantize(Decimal("1")))

    def is_deal_registered(self, trade_id: str) -> bool:
        """Queries on-chain registry to determine if a trade is already anchored."""
        if not self.is_connected():
            return False
        try:
            contract = self.get_contract()
            return bool(contract.functions.isDealRegistered(str(trade_id)).call())
        except Exception:
            return False

    def get_deal(self, trade_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves stored deal metadata from the blockchain."""
        if not self.is_connected():
            return None
        try:
            contract = self.get_contract()
            if not contract.functions.isDealRegistered(str(trade_id)).call():
                return None
            deal = contract.functions.getDeal(str(trade_id)).call()
            # deal is a tuple: (tradeId, verificationReference, tradeCanonicalHash, energyScaled, totalScaled, anchoredAt, anchoredBy)
            raw_hash = deal[2]
            hash_hex = raw_hash.hex() if isinstance(raw_hash, (bytes, HexBytes)) else str(raw_hash)
            if hash_hex.startswith("0x"):
                hash_hex = hash_hex[2:]

            return {
                "trade_id": deal[0],
                "verification_reference": deal[1],
                "trade_canonical_hash": hash_hex,
                "energy_amount_kwh_scaled": deal[3],
                "energy_amount_kwh": float(deal[3]) / self.SCALE_FACTOR,
                "total_amount_scaled": deal[4],
                "total_amount": float(deal[4]) / self.SCALE_FACTOR,
                "anchored_at": datetime.fromtimestamp(deal[5], tz=timezone.utc),
                "anchored_by": deal[6]
            }
        except Exception as e:
            return None

    def verify_deal_hash(self, trade_id: str, canonical_hash_hex: str) -> bool:
        """Verifies if the supplied canonical hash matches the anchored commitment on-chain."""
        if not self.is_connected():
            return False
        try:
            contract = self.get_contract()
            bytes32_hash = self.format_hash_to_bytes32(canonical_hash_hex)
            return bool(contract.functions.verifyDealHash(str(trade_id), bytes32_hash).call())
        except Exception:
            return False

    def anchor_trade(
        self,
        trade_id: str,
        verification_reference: str,
        canonical_hash_hex: str,
        energy_kwh: float,
        total_amount: float
    ) -> Dict[str, Any]:
        """
        Anchors an already-verified trade onto the EnergyDealRegistry smart contract.
        Idempotent: Returns existing on-chain registration if already registered.
        """
        self.validate_connection_and_chain()
        w3 = self.get_w3()
        contract = self.get_contract()

        trade_id_str = str(trade_id).strip()
        ref_str = str(verification_reference).strip()
        bytes32_hash = self.format_hash_to_bytes32(canonical_hash_hex)
        energy_scaled = self.scale_numeric_value(energy_kwh)
        total_scaled = self.scale_numeric_value(total_amount)

        # 1. Idempotency Check: Already anchored on-chain?
        if contract.functions.isDealRegistered(trade_id_str).call():
            existing_deal = self.get_deal(trade_id_str)
            return {
                "trade_id": trade_id_str,
                "verification_reference": ref_str,
                "trade_canonical_hash": canonical_hash_hex.lower().replace("0x", ""),
                "blockchain_status": "anchored",
                "blockchain_tx_hash": None, # Idempotent read
                "blockchain_block_number": None,
                "blockchain_contract_address": Web3.to_checksum_address(self.contract_address_raw),
                "blockchain_anchored_at": existing_deal.get("anchored_at") if existing_deal else datetime.now(timezone.utc),
                "already_registered": True
            }

        # 2. Relayer Account Setup
        if not self.private_key:
            raise BlockchainServiceError("No BLOCKCHAIN_PRIVATE_KEY configured for relayer transactions.")

        account = Account.from_key(self.private_key)
        relayer_address = account.address

        # 3. Build Transaction
        nonce = w3.eth.get_transaction_count(relayer_address, "pending")
        gas_price = w3.eth.gas_price

        tx_fn = contract.functions.registerDeal(
            trade_id_str,
            ref_str,
            bytes32_hash,
            energy_scaled,
            total_scaled
        )

        try:
            estimated_gas = tx_fn.estimate_gas({"from": relayer_address})
            gas_limit = int(estimated_gas * 1.2)
        except Exception:
            gas_limit = 350000

        tx_payload = tx_fn.build_transaction({
            "from": relayer_address,
            "nonce": nonce,
            "gas": gas_limit,
            "gasPrice": gas_price,
            "chainId": self.chain_id,
        })

        # 4. Sign and Broadcast
        signed_tx = w3.eth.account.sign_transaction(tx_payload, private_key=self.private_key)
        tx_hash_bytes = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        tx_hash_hex = tx_hash_bytes.hex()
        if not tx_hash_hex.startswith("0x"):
            tx_hash_hex = "0x" + tx_hash_hex

        # 5. Wait for Transaction Receipt
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=15)
        if receipt.get("status") != 1:
            raise BlockchainContractError(f"Transaction failed / reverted on-chain. TxHash: {tx_hash_hex}")

        block_number = int(receipt.get("blockNumber", 0))
        contract_addr = Web3.to_checksum_address(self.contract_address_raw)
        anchored_time = datetime.now(timezone.utc)

        return {
            "trade_id": trade_id_str,
            "verification_reference": ref_str,
            "trade_canonical_hash": canonical_hash_hex.lower().replace("0x", ""),
            "blockchain_status": "anchored",
            "blockchain_tx_hash": tx_hash_hex,
            "blockchain_block_number": block_number,
            "blockchain_contract_address": contract_addr,
            "blockchain_anchored_at": anchored_time,
            "already_registered": False
        }

# Global singleton instance
blockchain_service = BlockchainService()
