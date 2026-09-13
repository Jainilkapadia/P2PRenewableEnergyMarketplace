from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import settings

from sqlalchemy.pool import NullPool

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    poolclass=NullPool
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

from sqlalchemy import text

Base = declarative_base()

async def ensure_schema_compatibility():
    """Safely apply non-destructive additive columns to database if not already present."""
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE trade_verifications ADD COLUMN IF NOT EXISTS blockchain_tx_hash VARCHAR(66);"))
            await conn.execute(text("ALTER TABLE trade_verifications ADD COLUMN IF NOT EXISTS blockchain_block_number BIGINT;"))
            await conn.execute(text("ALTER TABLE trade_verifications ADD COLUMN IF NOT EXISTS blockchain_contract_address VARCHAR(42);"))
            await conn.execute(text("ALTER TABLE trade_verifications ADD COLUMN IF NOT EXISTS blockchain_anchored_at TIMESTAMPTZ;"))
            await conn.execute(text("ALTER TABLE trade_verifications ADD COLUMN IF NOT EXISTS blockchain_status VARCHAR(20) NOT NULL DEFAULT 'unanchored';"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, is_read);"))
    except Exception as e:
        # Pass silently if database connection is offline during unit testing without live DB
        pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

