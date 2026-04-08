from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.routes import puzzle, guess, hints, admin
from app.db.database import engine
from app.db.models import Base
from app.limiter import limiter


def run_migrations(engine):
    """Run database migrations for new columns."""
    from sqlalchemy import text
    from sqlalchemy.exc import OperationalError
    with engine.connect() as conn:
        # Add is_hint column if it doesn't exist
        try:
            conn.execute(text("ALTER TABLE user_attempts ADD COLUMN is_hint BOOLEAN DEFAULT FALSE"))
            conn.commit()
            print("Migration: Added is_hint column to user_attempts")
        except OperationalError as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                pass  # Column already exists — expected
            else:
                raise  # Unexpected migration error; surface it


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create database tables
    Base.metadata.create_all(bind=engine)
    # Run migrations for new columns
    run_migrations(engine)
    yield
    # Shutdown: cleanup if needed


app = FastAPI(
    title="Map Guessing API",
    description="Wordle-like game for guessing what maps represent",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js dev server
        "http://127.0.0.1:3000",
        "http://localhost:3050",
        "http://127.0.0.1:3050",
        "https://map-guessing.vercel.app",
        "https://canyouguessthemap.com",  # Production
        "https://www.canyouguessthemap.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Content-Type", "X-Player-ID", "X-Admin-Password"],
    expose_headers=["X-Player-ID"],
)

# Include routers
app.include_router(puzzle.router)
app.include_router(guess.router)
app.include_router(hints.router)
app.include_router(admin.router)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/")
async def root():
    return {
        "name": "Map Guessing API",
        "version": "1.0.0",
        "docs": "/docs",
    }
