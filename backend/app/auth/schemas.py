from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    email: str
    full_name: str
    role: str

class TokenData(BaseModel):
    user_id: Optional[str] = None

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Optional[str] = "dual"
    latitude: Optional[float] = 23.0225
    longitude: Optional[float] = 72.5714
    address_text: Optional[str] = "Ahmedabad, Gujarat"
    grid_substation_id: Optional[str] = "AHMEDABAD_SUB_ZONE_1"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    address_text: Optional[str] = None
    grid_substation_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    class Config:
        from_attributes = True

class KeyRegister(BaseModel):
    public_key_hex: str
    algorithm: Optional[str] = "Ed25519"
