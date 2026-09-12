from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

# Import Domain Routers
from app.auth.routes import router as auth_router
from app.users.routes import router as users_router
from app.marketplace.routes import router as marketplace_router
from app.requirements.routes import router as requirements_router
from app.matching.routes import router as matching_router
from app.trades.routes import router as trades_router
from app.verification.routes import router as verification_router
from app.reliability.routes import router as reliability_router
from app.wallet.routes import router as wallet_router
from app.notifications.routes import router as notifications_router
from app.analytics.routes import router as analytics_router
from app.disputes.routes import router as disputes_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Decentralized Peer-to-Peer Renewable Energy Trading Platform with Cryptographic Verification and Smart Matching.",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Sub-Routers under /api/v1
api_prefix = settings.API_V1_STR
app.include_router(auth_router, prefix=api_prefix)
app.include_router(users_router, prefix=api_prefix)
app.include_router(marketplace_router, prefix=api_prefix)
app.include_router(requirements_router, prefix=api_prefix)
app.include_router(matching_router, prefix=api_prefix)
app.include_router(trades_router, prefix=api_prefix)
app.include_router(verification_router, prefix=api_prefix)
app.include_router(reliability_router, prefix=api_prefix)
app.include_router(wallet_router, prefix=api_prefix)
app.include_router(notifications_router, prefix=api_prefix)
app.include_router(analytics_router, prefix=api_prefix)
app.include_router(disputes_router, prefix=api_prefix)

@app.get("/")
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
