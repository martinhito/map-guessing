from typing import List, Optional

from sqlalchemy.orm import Session

from app.db.models import UserAttempt, DailyGameState


class AttemptService:
    """Service for tracking user attempts."""

    def __init__(self, db: Session):
        self.db = db

    def get_user_attempts(self, user_id: str, puzzle_date: str) -> List[UserAttempt]:
        """Get all attempts for a user for a specific puzzle."""
        return (
            self.db.query(UserAttempt)
            .filter(
                UserAttempt.user_id == user_id,
                UserAttempt.puzzle_date == puzzle_date,
            )
            .order_by(UserAttempt.created_at.desc())
            .all()
        )

    def get_game_state(self, user_id: str, puzzle_date: str) -> Optional[DailyGameState]:
        """Get current game state for user."""
        return (
            self.db.query(DailyGameState)
            .filter(
                DailyGameState.user_id == user_id,
                DailyGameState.puzzle_date == puzzle_date,
            )
            .first()
        )

    def record_attempt(
        self,
        user_id: str,
        puzzle_date: str,
        guess_text: str,
        similarity_score: float,
        is_correct: bool,
    ) -> DailyGameState:
        """Record a new attempt and update game state."""
        # Create attempt record
        attempt = UserAttempt(
            user_id=user_id,
            puzzle_date=puzzle_date,
            guess_text=guess_text,
            similarity_score=similarity_score,
            is_correct=is_correct,
        )
        self.db.add(attempt)

        # Update or create game state
        game_state = self.get_game_state(user_id, puzzle_date)
        if not game_state:
            game_state = DailyGameState(
                user_id=user_id,
                puzzle_date=puzzle_date,
                total_guesses=0,
                solved=False,
                hints_revealed=0,
            )
            self.db.add(game_state)

        game_state.total_guesses += 1
        if is_correct:
            game_state.solved = True

        self.db.commit()
        self.db.refresh(game_state)
        return game_state

    def record_hint_used(self, user_id: str, puzzle_date: str, hint_text: str) -> int:
        """Record that a hint was revealed. Costs one guess. Returns new hint count."""
        # Create attempt record for the hint
        attempt = UserAttempt(
            user_id=user_id,
            puzzle_date=puzzle_date,
            guess_text=hint_text,
            similarity_score=0.0,
            is_correct=False,
            is_hint=True,
        )
        self.db.add(attempt)

        # Update or create game state
        game_state = self.get_game_state(user_id, puzzle_date)
        if not game_state:
            game_state = DailyGameState(
                user_id=user_id,
                puzzle_date=puzzle_date,
                total_guesses=0,
                solved=False,
                hints_revealed=0,
            )
            self.db.add(game_state)

        game_state.hints_revealed += 1
        game_state.total_guesses += 1  # Hints cost a guess!
        self.db.commit()
        return game_state.hints_revealed

    def reset_game(self, user_id: str, puzzle_date: str) -> None:
        """Reset game state and delete attempts for debugging."""
        # Delete all attempts
        self.db.query(UserAttempt).filter(
            UserAttempt.user_id == user_id,
            UserAttempt.puzzle_date == puzzle_date,
        ).delete()

        # Delete game state
        self.db.query(DailyGameState).filter(
            DailyGameState.user_id == user_id,
            DailyGameState.puzzle_date == puzzle_date,
        ).delete()

        self.db.commit()
