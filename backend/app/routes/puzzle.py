import re
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Response, Cookie, Header, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import DailyGameState
from app.models.puzzle import PuzzleResponse, AttemptsResponse, AttemptInfo, PlayerStatsResponse
from app.services.s3 import get_s3_service, S3PuzzleService
from app.services.attempts import AttemptService

router = APIRouter(prefix="/api", tags=["puzzle"])

_SAFE_PUZZLE_ID = re.compile(r"^[\w-]{1,64}$")


def _validate_puzzle_id(puzzle_id: str) -> None:
    if not _SAFE_PUZZLE_ID.match(puzzle_id):
        raise HTTPException(status_code=400, detail="Invalid puzzle ID format")


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
    _validate_puzzle_id(puzzle_id)
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


@router.get("/player/stats", response_model=PlayerStatsResponse)
async def get_player_stats(
    player_id: Optional[str] = Cookie(None),
    x_player_id: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Get player's overall stats: games played, win rate, streaks, guess distribution."""
    effective_player_id = x_player_id or player_id
    if not effective_player_id:
        raise HTTPException(status_code=400, detail="Player ID required")

    # Get all game states for this player
    games = (
        db.query(DailyGameState)
        .filter(DailyGameState.user_id == effective_player_id)
        .order_by(DailyGameState.puzzle_date.asc())
        .all()
    )

    total_played = len(games)
    solved_games = [g for g in games if g.solved]
    total_solved = len(solved_games)
    success_rate = total_solved / total_played if total_played > 0 else 0.0

    # Guess distribution (only solved games)
    dist: dict[int, int] = {}
    total_guesses_solved = 0
    for g in solved_games:
        n = g.total_guesses
        dist[n] = dist.get(n, 0) + 1
        total_guesses_solved += n
    avg_guesses = total_guesses_solved / total_solved if total_solved > 0 else 0.0

    # Total hints used
    hints_used = sum(g.hints_revealed for g in games)

    # Streak calculation (based on consecutive solved dates)
    current_streak = 0
    max_streak = 0
    streak = 0
    sorted_dates = sorted(set(g.puzzle_date for g in games))
    solved_dates = set(g.puzzle_date for g in solved_games)

    from datetime import date, timedelta
    for i, d in enumerate(sorted_dates):
        if d in solved_dates:
            if i == 0:
                streak = 1
            else:
                prev = date.fromisoformat(sorted_dates[i - 1])
                curr = date.fromisoformat(d)
                if (curr - prev).days == 1:
                    streak += 1
                else:
                    streak = 1
        else:
            streak = 0
        max_streak = max(max_streak, streak)
    current_streak = streak

    return PlayerStatsResponse(
        totalPlayed=total_played,
        totalSolved=total_solved,
        successRate=round(success_rate, 3),
        currentStreak=current_streak,
        maxStreak=max_streak,
        averageGuesses=round(avg_guesses, 1),
        guessDistribution=dist,
        hintsUsed=hints_used,
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
    _validate_puzzle_id(puzzle_id)
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
                isHint=a.is_hint,
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
