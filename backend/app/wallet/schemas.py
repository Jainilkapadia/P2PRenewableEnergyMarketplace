from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from typing import List, Optional

class WalletDepositRequest(BaseModel):
    amount: float = Field(gt=0, description="Deposit amount in USD")

class WalletTransactionResponse(BaseModel):
    id: UUID
    trade_id: Optional[UUID] = None
    transaction_type: str
    amount: float
    balance_after: float
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class WalletResponse(BaseModel):
    id: UUID
    user_id: UUID
    available_balance: float
    escrow_balance: float
    total_balance: float
    currency: str
    recent_transactions: List[WalletTransactionResponse] = []
    updated_at: datetime

    class Config:
        from_attributes = True
