# P2P Renewable Energy Trading Marketplace — Developer & Demo Guide

## Quick Start (Local & Offline-Ready)

### 1. Start Database & Backend with Docker Compose
```bash
docker-compose up -d
```
This automatically boots:
- **PostgreSQL 16 + PostGIS** on `localhost:5432` with pre-loaded demo users, prosumer listings, and historical trade proofs in `Bengaluru, India`.
- **FastAPI Modular Monolith Backend** on `http://localhost:8000` (Swagger docs available at `http://localhost:8000/docs`).

### 2. Run Backend Locally (Without Docker)
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Unix/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Run Backend Test Suite
```bash
cd backend
pytest -v
```

---

## Pre-Seeded Demo Accounts (Ahmedabad Clean Energy Microgrid)

| Role | Name | Email | Password | Pre-loaded Balance |
| :--- | :--- | :--- | :--- | :--- |
| **Prosumer** | Aarav Sharma (Solar Prosumer) | `aarav.prosumer@solar.io` | `password123` | ₹12,500.00 INR (98.5% Trust) |
| **Consumer** | Priya Patel (EV Consumer) | `priya.consumer@eco.io` | `password123` | ₹8,500.00 INR (96.0% Trust) |
| **Dual User**| Rohan Verma (Dual Prosumer) | `rohan.dual@greenenergy.in` | `password123` | ₹15,000.00 INR (100% Trust) |
| **Prosumer** | Dr. Kavita Rao (Microgrid Host)| `kavita.solar@cleanpower.org` | `password123` | ₹21,000.00 INR (94.2% Trust) |
| **Admin** | Torrent Power Smart Grid Admin | `admin@p2penergy.gov.in` | `password123` | ₹500,000.00 INR |

---

## Core Product Pillars
1. **Nearby Prosumer Map**: MapLibre spatial visualization of active solar surpluses with live distance and feeder metrics.
2. **Smart Constraint Matching**: Multi-objective scoring combining price arbitrage, physical transmission distance, verifiable reliability, and grid substation stability.
3. **Explainable AI Matching**: Clear human-readable breakdown of match ranking factors.
4. **Cryptographic Proofs**: Ed25519 digital signatures binding canonical trade hashes, verifiable by any peer.
5. **Verifiable Reliability**: Mathematical reputation score calculated directly from signed on-chain receipts rather than arbitrary reviews.
6. **Double-Entry Escrow Wallet**: Internal settlement engine guaranteeing instant buyer hold and verified seller payout.
