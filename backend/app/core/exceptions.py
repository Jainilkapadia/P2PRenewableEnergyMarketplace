from fastapi import HTTPException, status

class EntityNotFoundException(HTTPException):
    def __init__(self, entity_name: str, entity_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{entity_name} with ID '{entity_id}' was not found."
        )

class InvalidSignatureException(HTTPException):
    def __init__(self, detail: str = "Cryptographic signature validation failed."):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )

class InsufficientWalletBalanceException(HTTPException):
    def __init__(self, required: float, available: float):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient balance. Required: ${required:.2f}, Available: ${available:.2f}"
        )

class InvalidTradeStateException(HTTPException):
    def __init__(self, current_status: str, action: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot perform '{action}' on trade in '{current_status}' state."
        )
