# P2P Renewable Energy Blockchain Anchor Layer

This directory contains the isolated EVM smart contract anchor workspace for the P2P Renewable Energy Trading Marketplace (Milestone 6).

## Overview

The `EnergyDealRegistry` smart contract provides an immutable, decentralized anchor for energy trades that have already been dual-signed (Ed25519) and verified by the marketplace application (Milestone 5).

### Key Architectural Principles
1. **Separation of Concerns:** Business logic, matching, and Ed25519 signature validation remain authoritative in FastAPI. The smart contract acts exclusively as an immutable cryptographic commitment registry.
2. **Deterministic Numeric Scaling:** Energy (`kWh`) and currency (`INR`) values are scaled deterministically by `100` (`SCALE_FACTOR = 100`) to avoid floating-point loss:
   * `25.50 kWh` → `2550`
   * `145.00 INR` → `14500`
3. **Privacy Preservation:** Buyer and seller personal data/database UUIDs are not stored on-chain. Only the authoritative `tradeId`, `verificationReference`, and SHA-256 canonical hash are recorded.
4. **Duplicate Protection:** Re-anchoring an already registered `tradeId` reverts at the contract level.
5. **Tamper Detection:** The `verifyDealHash(tradeId, hash)` function compares any supplied SHA-256 payload digest against the immutable on-chain commitment.

---

## Workspace Layout

```text
blockchain/
├── contracts/
│   └── EnergyDealRegistry.sol        # Solidity smart contract
├── scripts/
│   └── deploy.ts                     # Deployment script
├── test/
│   └── EnergyDealRegistry.test.ts    # Contract test suite (11 test cases)
├── hardhat.config.ts                 # Hardhat configuration
├── package.json                      # Isolated package dependencies
├── tsconfig.json                     # TypeScript configuration
└── README.md
```

---

## Commands

### 1. Compile Contracts
```bash
npm run compile
```

### 2. Run Tests
```bash
npm test
```

### 3. Start Local Hardhat Node
```bash
npx hardhat node
```
* **Local RPC URL:** `http://127.0.0.1:8545`
* **Chain ID:** `31337`

### 4. Deploy to Local Node
In a separate terminal:
```bash
npx hardhat run scripts/deploy.ts --network localhost
```

---

## Smart Contract Interface

```solidity
struct EnergyDeal {
    string tradeId;
    string verificationReference;
    bytes32 tradeCanonicalHash;
    uint256 energyAmountKwhScaled;
    uint256 totalAmountScaled;
    uint256 anchoredAt;
    address anchoredBy;
}

function registerDeal(
    string calldata tradeId,
    string calldata verificationReference,
    bytes32 tradeCanonicalHash,
    uint256 energyAmountKwhScaled,
    uint256 totalAmountScaled
) external returns (bool);

function getDeal(string calldata tradeId) external view returns (EnergyDeal memory);

function isDealRegistered(string calldata tradeId) external view returns (bool);

function verifyDealHash(string calldata tradeId, bytes32 tradeCanonicalHash) external view returns (bool);
```
