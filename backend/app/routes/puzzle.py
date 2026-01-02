from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Response, Cookie, Header, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.puzzle import PuzzleResponse, AttemptsResponse, AttemptInfo
from app.services.s3 import get_s3_service, S3PuzzleService
from app.services.attempts import AttemptService

router = APIRouter(prefix="/api", tags=["puzzle"])


def get_or_set_player_id(
    response: Response,
    player_id: Optional[str] = Cookie(None),
    x_player_id: Optional[str] = Header(None),
) -> str:
    """Get existing player ID from header, cookie, or create a new one."""
    # Prefer header (for mobile/cross-domain), fall back to cookie
    existing_id = x_player_id or player_id

    if existing_id:
        return existing_id

    # Create new player ID
    new_id = f"p_{uuid4().hex}"

    # Set cookie for desktop browsers that support it
    response.set_cookie(
        key="player_id",
        value=new_id,
        max_age=365 * 24 * 60 * 60,  # 1 year
        httponly=True,
        samesite="none",
        secure=True,
    )

    # Also set a header so frontend can store it
    response.headers["X-Player-ID"] = new_id

    return new_id


@router.get("/puzzle", response_model=PuzzleResponse)
async def get_daily_puzzle(
    response: Response,
    player_id: Optional[str] = Cookie(None),
    x_player_id: Optional[str] = Header(None),
    s3_service: S3PuzzleService = Depends(get_s3_service),
):
    """Get today's challenge (image + hint count, not answer)."""
    player_id = get_or_set_player_id(response, player_id, x_player_id)

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
        sourceText=puzzle.sourceText,
    )


@router.get("/puzzle/{puzzle_id}", response_model=PuzzleResponse)
async def get_puzzle_by_id(
    puzzle_id: str,
    response: Response,
    player_id: Optional[str] = Cookie(None),
    x_player_id: Optional[str] = Header(None),
    s3_service: S3PuzzleService = Depends(get_s3_service),
):
    """Get a specific puzzle by ID."""
    player_id = get_or_set_player_id(response, player_id, x_player_id)

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
        sourceText=puzzle.sourceText,
    )


@router.get("/puzzle/{puzzle_id}/attempts", response_model=AttemptsResponse)
async def get_user_attempts(
    puzzle_id: str,
    player_id: Optional[str] = Cookie(None),
    x_player_id: Optional[str] = Header(None),
    db: Session = Depends(get_db),
    s3_service: S3PuzzleService = Depends(get_s3_service),
):
    """Get user's attempts for a specific puzzle."""
    effective_player_id = x_player_id or player_id
    if not effective_player_id:
        return AttemptsResponse(attempts=[], gameState=None)

    attempt_service = AttemptService(db)
    attempts = attempt_service.get_user_attempts(effective_player_id, puzzle_id)
    game_state = attempt_service.get_game_state(effective_player_id, puzzle_id)

    # Check if game is over to reveal answer
    answer = None
    source_url = None
    if game_state:
        try:
            puzzle = s3_service.get_puzzle(puzzle_id)
            is_game_over = game_state.solved or game_state.total_guesses >= puzzle.maxGuesses
            if is_game_over:
                answer = puzzle.answer
                source_url = puzzle.sourceUrl
        except ValueError:
            pass  # Puzzle not found, just don't include answer

    return AttemptsResponse(
        attempts=[
            AttemptInfo(
                guess=a.guess_text,
                similarity=a.similarity_score,
                correct=a.is_correct,
                timestamp=a.created_at.isoformat(),
                isHint=getattr(a, 'is_hint', False),
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
        answer=answer,
        sourceUrl=source_url,
    )
