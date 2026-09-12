from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone
from typing import List

from app.core.database import get_db
from app.auth.routes import get_current_user
from app.models import User, Wallet, WalletTransaction
from app.wallet.schemas import WalletResponse, WalletDepositRequest, WalletTransactionResponse

router = APIRouter(prefix="/wallet", tags=["Wallet & Ledger Simulation"])

@router.get("/me", response_model=WalletResponse)
async def get_my_wallet(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    wallet_res = await db.execute(select(Wallet).where(Wallet.user_id == current_user.id))
    wallet = wallet_res.scalar_one_or_none()
    if not wallet:
        wallet = Wallet(user_id=current_user.id, available_balance=1000.0, escrow_balance=0.0)
        db.add(wallet)
        await db.commit()
        await db.refresh(wallet)

    tx_res = await db.execute(
        select(WalletTransaction)
        .where(WalletTransaction.wallet_id == wallet.id)
        .order_by(desc(WalletTransaction.created_at))
        .limit(20)
    )
    transactions = tx_res.scalars().all()

    tx_list = [
        WalletTransactionResponse(
            id=tx.id,
            trade_id=tx.trade_id,
            transaction_type=tx.transaction_type,
            amount=float(tx.amount),
            balance_after=float(tx.balance_after),
            description=tx.description,
            created_at=tx.created_at
        ) for tx in transactions
    ]

    avail = float(wallet.available_balance)
    escrow = float(wallet.escrow_balance)

    return WalletResponse(
        id=wallet.id,
        user_id=wallet.user_id,
        available_balance=avail,
        escrow_balance=escrow,
        total_balance=avail + escrow,
        currency=wallet.currency,
        recent_transactions=tx_list,
        updated_at=wallet.updated_at
    )

@router.post("/deposit", response_model=WalletResponse)
async def deposit_funds(
    req: WalletDepositRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    wallet_res = await db.execute(select(Wallet).where(Wallet.user_id == current_user.id))
    wallet = wallet_res.scalar_one_or_none()
    if not wallet:
        wallet = Wallet(user_id=current_user.id, available_balance=1000.0, escrow_balance=0.0)
        db.add(wallet)
        await db.flush()

    wallet.available_balance = float(wallet.available_balance) + req.amount
    wallet.updated_at = datetime.now(timezone.utc)

    tx = WalletTransaction(
        wallet_id=wallet.id,
        transaction_type="deposit",
        amount=req.amount,
        balance_after=wallet.available_balance,
        description=f"Simulated deposit of ${req.amount:.2f} USD"
    )
    db.add(tx)
    await db.commit()
    await db.refresh(wallet)

    return await get_my_wallet(current_user, db)
