from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Response, Cookie, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.puzzle import PuzzleResponse, AttemptsResponse, AttemptInfo
from app.services.s3 import get_s3_service, S3PuzzleService
from app.services.attempts import AttemptService

router = APIRouter(prefix="/api", tags=["puzzle"])


def get_or_set_player_id(response: Response, player_id: Optional[str] = Cookie(None)) -> str:
    """Get existing player ID or create a new one."""
    if not player_id:
        player_id = f"p_{uuid4().hex}"
        response.set_cookie(
            key="player_id",
            value=player_id,
            max_age=365 * 24 * 60 * 60,  # 1 year
            httponly=True,
            samesite="none",
            secure=True,  # Required for samesite=none
        )
    return player_id


@router.get("/puzzle", response_model=PuzzleResponse)
async def get_daily_puzzle(
    response: Response,
    player_id: Optional[str] = Cookie(None),
    s3_service: S3PuzzleService = Depends(get_s3_service),
):
    """Get today's challenge (image + hint count, not answer)."""
    player_id = get_or_set_player_id(response, player_id)

    try:
        puzzle = s3_service.get_puzzle()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    hints_count = len(puzzle.hints) if puzzle.hints else 0

    return PuzzleResponse(
        id=puzzle.id,
        imageUrl=puzzle.imageUrl,
        maxGuesses=puzzle.maxGuesses,
        similarityThreshold=puzzle.similarityThreshold,
        prompt="Guess what this map represents",
        hintsAvailable=hints_count,
    )


@router.get("/puzzle/{puzzle_id}", response_model=PuzzleResponse)
async def get_puzzle_by_id(
    puzzle_id: str,
    response: Response,
    player_id: Optional[str] = Cookie(None),
    s3_service: S3PuzzleService = Depends(get_s3_service),
):
    """Get a specific puzzle by ID."""
    player_id = get_or_set_player_id(response, player_id)

    try:
        puzzle = s3_service.get_puzzle(puzzle_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    hints_count = len(puzzle.hints) if puzzle.hints else 0

    return PuzzleResponse(
        id=puzzle.id,
        imageUrl=puzzle.imageUrl,
        maxGuesses=puzzle.maxGuesses,
        similarityThreshold=puzzle.similarityThreshold,
        prompt="Guess what this map represents",
        hintsAvailable=hints_count,
    )


@router.get("/puzzle/{puzzle_id}/attempts", response_model=AttemptsResponse)
async def get_user_attempts(
    puzzle_id: str,
    player_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
):
    """Get user's attempts for a specific puzzle."""
    if not player_id:
        return AttemptsResponse(attempts=[], gameState=None)

    attempt_service = AttemptService(db)
    attempts = attempt_service.get_user_attempts(player_id, puzzle_id)
    game_state = attempt_service.get_game_state(player_id, puzzle_id)

    return AttemptsResponse(
        attempts=[
            AttemptInfo(
                guess=a.guess_text,
                similarity=a.similarity_score,
                correct=a.is_correct,
                timestamp=a.created_at.isoformat(),
            )
            for a in attempts
        ],
        gameState={
            "solved": game_state.solved,
            "totalGuesses": game_state.total_guesses,
            "hintsRevealed": game_state.hints_revealed,
        }
        if game_state
        else None,
    )
