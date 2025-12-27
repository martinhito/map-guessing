from typing import Optional

from fastapi import APIRouter, Depends, Cookie, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.puzzle import GuessRequest, GuessResponse
from app.services.s3 import get_s3_service, S3PuzzleService
from app.services.embedding import get_embedding_service, EmbeddingService
from app.services.similarity import cosine_similarity
from app.services.attempts import AttemptService

router = APIRouter(prefix="/api", tags=["guess"])


@router.post("/puzzle/{puzzle_id}/guess", response_model=GuessResponse)
async def submit_guess(
    puzzle_id: str,
    request: GuessRequest,
    player_id: Optional[str] = Cookie(None),
    s3_service: S3PuzzleService = Depends(get_s3_service),
    embedding_service: EmbeddingService = Depends(get_embedding_service),
    db: Session = Depends(get_db),
):
    """Submit a guess and get similarity score."""
    if not player_id:
        raise HTTPException(status_code=400, detail="Player ID required (cookie missing)")

    if not request.guess or not request.guess.strip():
        raise HTTPException(status_code=400, detail="Guess cannot be empty")

    # Get puzzle data
    try:
        puzzle = s3_service.get_puzzle(puzzle_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    attempt_service = AttemptService(db)

    # Check current game state
    game_state = attempt_service.get_game_state(player_id, puzzle_id)

    # Already solved
    if game_state and game_state.solved:
        return GuessResponse(
            correct=True,
            gameOver=True,
            similarity=1.0,
            remainingGuesses=puzzle.maxGuesses - game_state.total_guesses,
            message="Already solved!",
            answer=puzzle.answer,
            attemptsUsed=game_state.total_guesses,
        )

    # Out of guesses
    if game_state and game_state.total_guesses >= puzzle.maxGuesses:
        return GuessResponse(
            correct=False,
            gameOver=True,
            similarity=0.0,
            remainingGuesses=0,
            message="No guesses remaining",
            answer=puzzle.answer,
            attemptsUsed=game_state.total_guesses,
        )

    # Calculate similarity against all answer variants
    guess_text = request.guess.strip().lower()
    guess_embedding = await embedding_service.embed(guess_text)

    # Check against all variants and take the best match
    best_similarity = cosine_similarity(puzzle.answerEmbedding, guess_embedding)

    if puzzle.answerVariants:
        for variant in puzzle.answerVariants:
            variant_similarity = cosine_similarity(variant.embedding, guess_embedding)
            if variant_similarity > best_similarity:
                best_similarity = variant_similarity

    similarity = best_similarity
    is_correct = similarity >= puzzle.similarityThreshold

    # Record attempt
    updated_state = attempt_service.record_attempt(
        user_id=player_id,
        puzzle_date=puzzle_id,
        guess_text=guess_text,
        similarity_score=similarity,
        is_correct=is_correct,
    )

    remaining = max(puzzle.maxGuesses - updated_state.total_guesses, 0)
    game_over = is_correct or remaining == 0

    if is_correct:
        message = "Correct! You got it!"
    elif remaining > 0:
        message = "Keep trying!"
    else:
        message = "Out of guesses"

    return GuessResponse(
        correct=is_correct,
        gameOver=game_over,
        similarity=similarity,
        remainingGuesses=remaining,
        message=message,
        answer=puzzle.answer if game_over else None,
        attemptsUsed=updated_state.total_guesses,
    )


@router.post("/puzzle/{puzzle_id}/reset")
async def reset_game(
    puzzle_id: str,
    player_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
):
    """Reset game state for debugging (localhost only)."""
    if not player_id:
        raise HTTPException(status_code=400, detail="Player ID required")

    attempt_service = AttemptService(db)
    attempt_service.reset_game(player_id, puzzle_id)

    return {"success": True, "message": f"Game reset for puzzle {puzzle_id}"}
