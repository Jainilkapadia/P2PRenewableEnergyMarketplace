from pydantic import BaseModel, EmailStr, model_validator
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
    public_key_hex: Optional[str] = None
    public_key: Optional[str] = None
    algorithm: Optional[str] = "Ed25519"

    @model_validator(mode="after")
    def resolve_fields(self):
        pk = self.public_key_hex or self.public_key
        if not pk:
            raise ValueError("public_key_hex or public_key is required")
        self.public_key_hex = pk
        return self
