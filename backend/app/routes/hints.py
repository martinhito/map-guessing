from typing import Optional

from fastapi import APIRouter, Depends, Cookie, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.puzzle import HintResponse
from app.services.s3 import get_s3_service, S3PuzzleService
from app.services.attempts import AttemptService

router = APIRouter(prefix="/api", tags=["hints"])


@router.get("/puzzle/{puzzle_id}/hint", response_model=HintResponse)
async def get_hint(
    puzzle_id: str,
    player_id: Optional[str] = Cookie(None),
    s3_service: S3PuzzleService = Depends(get_s3_service),
    db: Session = Depends(get_db),
):
    """Get next hint for the puzzle."""
    if not player_id:
        raise HTTPException(status_code=400, detail="Player ID required")

    try:
        puzzle = s3_service.get_puzzle(puzzle_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if not puzzle.hints:
        raise HTTPException(status_code=404, detail="No hints available for this puzzle")

    attempt_service = AttemptService(db)
    game_state = attempt_service.get_game_state(player_id, puzzle_id)
    hints_revealed = game_state.hints_revealed if game_state else 0

    if hints_revealed >= len(puzzle.hints):
        raise HTTPException(status_code=400, detail="All hints already revealed")

    # Record hint usage and get next hint
    new_hint_count = attempt_service.record_hint_used(player_id, puzzle_id)
    hint_index = new_hint_count - 1

    return HintResponse(
        hintIndex=hint_index,
        hintText=puzzle.hints[hint_index],
        hintsRemaining=len(puzzle.hints) - new_hint_count,
    )


@router.get("/puzzle/{puzzle_id}/hints")
async def get_revealed_hints(
    puzzle_id: str,
    player_id: Optional[str] = Cookie(None),
    s3_service: S3PuzzleService = Depends(get_s3_service),
    db: Session = Depends(get_db),
):
    """Get all previously revealed hints for the puzzle."""
    if not player_id:
        return {"hints": [], "hintsRemaining": 0}

    try:
        puzzle = s3_service.get_puzzle(puzzle_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    attempt_service = AttemptService(db)
    game_state = attempt_service.get_game_state(player_id, puzzle_id)
    hints_revealed = game_state.hints_revealed if game_state else 0

    revealed_hints = puzzle.hints[:hints_revealed] if puzzle.hints else []
    total_hints = len(puzzle.hints) if puzzle.hints else 0

    return {
        "hints": revealed_hints,
        "hintsRemaining": max(total_hints - hints_revealed, 0),
    }
