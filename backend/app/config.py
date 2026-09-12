import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "P2P Renewable Energy Trading Marketplace"
    ENV: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"
    
    # JWT Security
    SECRET_KEY: str = "super-secret-jwt-key-for-local-hackathon-development"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours for hackathon demo ease
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/p2p_energy_db"
    
    # Default Grid & Spatial Config
    DEFAULT_GRID_SUBSTATION: str = "AHMEDABAD_SUB_ZONE_1"
    DEFAULT_MATCH_RADIUS_KM: float = 15.0

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"

settings = Settings()
