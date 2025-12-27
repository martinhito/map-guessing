from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Index
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class UserAttempt(Base):
    """Records individual guess attempts."""

    __tablename__ = "user_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False, index=True)
    puzzle_date = Column(String(10), nullable=False, index=True)
    guess_text = Column(String(512), nullable=False)
    similarity_score = Column(Float, nullable=False)
    is_correct = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_user_puzzle_date", "user_id", "puzzle_date"),
    )


class DailyGameState(Base):
    """Tracks overall game state per user per day."""

    __tablename__ = "daily_game_state"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False)
    puzzle_date = Column(String(10), nullable=False)
    solved = Column(Boolean, default=False)
    total_guesses = Column(Integer, default=0)
    hints_revealed = Column(Integer, default=0)

    __table_args__ = (
        Index("ix_user_date_unique", "user_id", "puzzle_date", unique=True),
    )
