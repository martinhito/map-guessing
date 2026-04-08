import json
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import boto3
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Header
from pydantic import BaseModel

from app.config import get_settings
from app.services.embedding import get_embedding_service, EmbeddingService
from app.services.llm import get_llm_service, LLMService
from app.services.s3 import get_s3_service, S3PuzzleService
from app.models.puzzle import PuzzleIndexEntry

router = APIRouter(prefix="/api/admin", tags=["admin"])

_SAFE_PUZZLE_ID = re.compile(r"^[\w-]{1,64}$")


def _get_admin_password() -> str:
    return get_settings().admin_password


def verify_admin(x_admin_password: Optional[str] = Header(None)):
    """Verify admin password from header."""
    if x_admin_password != _get_admin_password():
        raise HTTPException(status_code=401, detail="Invalid admin password")
    return True


def _validate_source_url(url: Optional[str]) -> Optional[str]:
    """Validate that a URL uses http or https scheme. Returns cleaned URL or None."""
    if not url or not url.strip():
        return None
    cleaned = url.strip()
    parsed = urlparse(cleaned)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=400,
            detail="sourceUrl must use http or https scheme",
        )
    return cleaned


class PuzzleCreateRequest(BaseModel):
    answer: str
    hints: list[str] = []
    date: Optional[str] = None  # YYYY-MM-DD format
    maxGuesses: int = 5
    similarityThreshold: float = 0.95


class PuzzleCreateResponse(BaseModel):
    success: bool
    puzzleId: str
    imageUrl: str
    message: str


@router.post("/verify")
async def verify_password(x_admin_password: Optional[str] = Header(None)):
    """Verify admin password."""
    if x_admin_password == _get_admin_password():
        return {"valid": True}
    raise HTTPException(status_code=401, detail="Invalid admin password")


@router.post("/generate-synonyms")
async def generate_synonyms(
    answer: str = Form(...),
    count: int = Form(10),
    _: bool = Depends(verify_admin),
    llm_service: LLMService = Depends(get_llm_service),
):
    """Generate synonym phrases for an answer."""
    synonyms = await llm_service.generate_synonyms(answer, count=count)
    return {"synonyms": synonyms}


@router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    date: str = Form(None),
    _: bool = Depends(verify_admin),
    s3_service: S3PuzzleService = Depends(get_s3_service),
):
    """Upload an image to S3 and return the URL."""
    settings = get_settings()

    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )

    # Determine puzzle date
    puzzle_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Get file extension from content type
    extension_map = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/gif": ".gif",
        "image/webp": ".webp",
    }
    extension = extension_map.get(file.content_type, ".png")

    # Read file content
    content = await file.read()

    # Upload to S3 using the service's shared client
    image_key = f"{settings.s3_puzzle_prefix}images/{puzzle_date}{extension}"

    s3_service.s3_client.put_object(
        Bucket=settings.s3_bucket_name,
        Key=image_key,
        Body=content,
        ContentType=file.content_type,
    )

    image_url = f"https://{settings.s3_bucket_name}.s3.{settings.aws_region}.amazonaws.com/{image_key}"

    return {
        "success": True,
        "imageUrl": image_url,
        "puzzleDate": puzzle_date,
    }


@router.post("/create-puzzle", response_model=PuzzleCreateResponse)
async def create_puzzle(
    imageUrl: str = Form(...),
    answer: str = Form(...),
    hints: str = Form(""),  # Comma-separated hints
    synonyms: str = Form(""),  # JSON array of synonym strings
    date: str = Form(None),
    maxGuesses: int = Form(5),
    similarityThreshold: float = Form(0.85),
    similarityMode: str = Form("embedding"),  # "embedding" or "llm"
    inEndlessPool: bool = Form(False),  # Add to endless mode pool
    scheduledDate: str = Form(None),  # Schedule for daily mode (YYYY-MM-DD)
    sourceText: str = Form(None),  # Source attribution text
    sourceUrl: str = Form(None),  # Source link (shown after game ends)
    _: bool = Depends(verify_admin),
    embedding_service: EmbeddingService = Depends(get_embedding_service),
    s3_service: S3PuzzleService = Depends(get_s3_service),
):
    """Create a puzzle with the given image and answer."""
    settings = get_settings()

    # Determine puzzle date / ID
    puzzle_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Duplicate-ID guard: reject if a puzzle with this ID already exists in the index
    index = s3_service.get_puzzle_index()
    if any(p.id == puzzle_date for p in index.puzzles):
        raise HTTPException(
            status_code=409,
            detail=f"A puzzle with ID '{puzzle_date}' already exists. "
                   "Use the update endpoint to modify it, or choose a different date/ID.",
        )

    # Parse hints (JSON array or comma-separated for backwards compatibility)
    hints_list = []
    if hints:
        try:
            hints_list = json.loads(hints)
        except json.JSONDecodeError:
            hints_list = [h.strip() for h in hints.split(",") if h.strip()]

    # Parse synonyms (JSON array)
    synonyms_list = []
    if synonyms:
        try:
            synonyms_list = json.loads(synonyms)
        except json.JSONDecodeError:
            pass

    # Build list of all texts to embed (answer + synonyms) - lowercase for consistency
    all_texts = [answer.lower()]
    clean_synonyms = [s.strip().lower() for s in synonyms_list if s and s.strip()]
    all_texts.extend(clean_synonyms)

    # Batch embed all texts in a single API call
    try:
        all_embeddings = await embedding_service.embed_batch(all_texts)

        # First embedding is for the answer
        answer_embedding = all_embeddings[0]

        # Build answer variants from results (store original text but use lowercased embedding)
        answer_variants = [{"text": answer.lower(), "embedding": answer_embedding}]
        for i, synonym in enumerate(clean_synonyms):
            answer_variants.append({
                "text": synonym,
                "embedding": all_embeddings[i + 1]
            })
    except Exception as e:
        # If batch fails, try just the answer
        print(f"Batch embedding failed: {e}, trying answer only")
        try:
            answer_embedding = await embedding_service.embed(answer.lower())
            answer_variants = [{"text": answer.lower(), "embedding": answer_embedding}]
        except Exception as e2:
            raise HTTPException(status_code=500, detail=f"Failed to embed answer: {e2}")

    # Parse mode options
    scheduled = scheduledDate if scheduledDate and scheduledDate.strip() else None
    created_at = datetime.now(timezone.utc).isoformat()

    # Parse and validate source fields
    source_text = sourceText.strip() if sourceText and sourceText.strip() else None
    source_url = _validate_source_url(sourceUrl)

    # Validate similarity mode
    sim_mode = similarityMode if similarityMode in ("embedding", "llm") else "embedding"

    # Create puzzle metadata
    puzzle_data = {
        "id": puzzle_date,
        "imageUrl": imageUrl,
        "answer": answer,
        "maxGuesses": maxGuesses,
        "similarityThreshold": similarityThreshold,
        "similarityMode": sim_mode,
        "answerEmbedding": answer_embedding,  # Keep for backwards compatibility
        "answerVariants": answer_variants,  # New: all variants with embeddings
        "hints": hints_list if hints_list else None,
        # Source attribution
        "sourceText": source_text,
        "sourceUrl": source_url,
        # New mode fields
        "createdAt": created_at,
        "inEndlessPool": inEndlessPool,
        "scheduledDate": scheduled,
    }

    # Upload to S3 using the service's shared client
    json_key = f"{settings.s3_puzzle_prefix}{puzzle_date}.json"
    json_content = json.dumps(puzzle_data, indent=2)

    s3_service.s3_client.put_object(
        Bucket=settings.s3_bucket_name,
        Key=json_key,
        Body=json_content.encode("utf-8"),
        ContentType="application/json",
    )

    # Add puzzle to the index
    from app.models.puzzle import PuzzleMetadata
    puzzle = PuzzleMetadata(**puzzle_data)
    s3_service.add_puzzle_to_index(puzzle)

    return PuzzleCreateResponse(
        success=True,
        puzzleId=puzzle_date,
        imageUrl=imageUrl,
        message=f"Puzzle created successfully for {puzzle_date}",
    )


# --- Dual Game Mode Endpoints ---


@router.get("/puzzles/all")
async def list_all_puzzles(
    _: bool = Depends(verify_admin),
):
    """Get all puzzles with their mode information."""
    s3_service = get_s3_service()
    puzzles = s3_service.get_all_puzzles()

    return {
        "puzzles": [p.model_dump() for p in puzzles],
    }


@router.get("/puzzles/endless-pool")
async def get_endless_pool(
    _: bool = Depends(verify_admin),
):
    """Get all puzzles in the endless pool."""
    s3_service = get_s3_service()
    puzzles = s3_service.get_endless_pool_puzzles()

    return {
        "puzzles": [p.model_dump() for p in puzzles],
        "count": len(puzzles),
    }


@router.post("/puzzles/{puzzle_id}/endless-pool")
async def toggle_endless_pool(
    puzzle_id: str,
    inPool: bool = Form(...),
    _: bool = Depends(verify_admin),
):
    """Add or remove a puzzle from the endless pool."""
    s3_service = get_s3_service()

    try:
        puzzle = s3_service.toggle_endless_pool(puzzle_id, inPool)
        return {
            "success": True,
            "puzzleId": puzzle_id,
            "inEndlessPool": puzzle.inEndlessPool,
            "message": f"Puzzle {'added to' if inPool else 'removed from'} endless pool",
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/puzzles/{puzzle_id}/schedule")
async def schedule_puzzle(
    puzzle_id: str,
    date: Optional[str] = Form(None),
    _: bool = Depends(verify_admin),
):
    """Schedule a puzzle for a specific date, or unschedule if date is empty."""
    s3_service = get_s3_service()

    # Empty string or None means unschedule
    schedule_date = date if date and date.strip() else None

    try:
        puzzle = s3_service.schedule_puzzle(puzzle_id, schedule_date)
        return {
            "success": True,
            "puzzleId": puzzle_id,
            "scheduledDate": puzzle.scheduledDate,
            "message": f"Puzzle scheduled for {schedule_date}" if schedule_date else "Puzzle unscheduled",
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/puzzles/{puzzle_id}/details")
async def get_puzzle_details(
    puzzle_id: str,
    _: bool = Depends(verify_admin),
):
    """Get full puzzle details for editing."""
    s3_service = get_s3_service()

    try:
        puzzle = s3_service.get_puzzle(puzzle_id)
        return {
            "id": puzzle.id,
            "imageUrl": puzzle.imageUrl,
            "answer": puzzle.answer,
            "maxGuesses": puzzle.maxGuesses,
            "similarityThreshold": puzzle.similarityThreshold,
            "similarityMode": puzzle.similarityMode,
            "hints": puzzle.hints or [],
            "sourceText": puzzle.sourceText,
            "sourceUrl": puzzle.sourceUrl,
            "inEndlessPool": puzzle.inEndlessPool,
            "scheduledDate": puzzle.scheduledDate,
            "answerVariants": [v.text for v in puzzle.answerVariants] if puzzle.answerVariants else [],
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/puzzles/{puzzle_id}")
async def update_puzzle(
    puzzle_id: str,
    answer: str = Form(...),
    hints: str = Form(""),
    synonyms: str = Form(""),
    maxGuesses: int = Form(5),
    similarityThreshold: float = Form(0.85),
    similarityMode: str = Form("embedding"),
    sourceText: str = Form(None),
    sourceUrl: str = Form(None),
    inEndlessPool: bool = Form(False),
    scheduledDate: str = Form(None),
    _: bool = Depends(verify_admin),
    embedding_service: EmbeddingService = Depends(get_embedding_service),
    s3_service: S3PuzzleService = Depends(get_s3_service),
):
    """Update an existing puzzle's metadata."""
    settings = get_settings()

    # Get existing puzzle
    try:
        existing = s3_service.get_puzzle(puzzle_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Parse hints (JSON array or comma-separated for backwards compatibility)
    hints_list = []
    if hints:
        try:
            hints_list = json.loads(hints)
        except json.JSONDecodeError:
            hints_list = [h.strip() for h in hints.split(",") if h.strip()]

    # Parse synonyms
    synonyms_list = []
    if synonyms:
        try:
            synonyms_list = json.loads(synonyms)
        except json.JSONDecodeError:
            pass

    # Check if answer changed - need to re-embed
    answer_changed = answer.lower() != existing.answer.lower()
    synonyms_changed = set([s.strip().lower() for s in synonyms_list]) != set(
        [v.text.lower() for v in existing.answerVariants] if existing.answerVariants else []
    )

    if answer_changed or synonyms_changed:
        # Re-embed answer and synonyms
        all_texts = [answer.lower()]
        clean_synonyms = [s.strip().lower() for s in synonyms_list if s and s.strip()]
        all_texts.extend(clean_synonyms)

        try:
            all_embeddings = await embedding_service.embed_batch(all_texts)
            answer_embedding = all_embeddings[0]
            answer_variants = [{"text": answer.lower(), "embedding": answer_embedding}]
            for i, synonym in enumerate(clean_synonyms):
                answer_variants.append({
                    "text": synonym,
                    "embedding": all_embeddings[i + 1]
                })
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to embed: {e}")
    else:
        # Keep existing embeddings
        answer_embedding = existing.answerEmbedding
        answer_variants = [v.model_dump() for v in existing.answerVariants] if existing.answerVariants else []

    # Parse and validate optional fields
    source_text = sourceText.strip() if sourceText and sourceText.strip() else None
    source_url = _validate_source_url(sourceUrl)
    scheduled = scheduledDate if scheduledDate and scheduledDate.strip() else None
    sim_mode = similarityMode if similarityMode in ("embedding", "llm") else "embedding"

    # Build updated puzzle data
    puzzle_data = {
        "id": puzzle_id,
        "imageUrl": existing.imageUrl,
        "answer": answer,
        "maxGuesses": maxGuesses,
        "similarityThreshold": similarityThreshold,
        "similarityMode": sim_mode,
        "answerEmbedding": answer_embedding,
        "answerVariants": answer_variants,
        "hints": hints_list if hints_list else None,
        "sourceText": source_text,
        "sourceUrl": source_url,
        "createdAt": existing.createdAt,
        "inEndlessPool": inEndlessPool,
        "scheduledDate": scheduled,
    }

    # Upload to S3 using the service's shared client
    json_key = f"{settings.s3_puzzle_prefix}{puzzle_id}.json"
    json_content = json.dumps(puzzle_data, indent=2)

    s3_service.s3_client.put_object(
        Bucket=settings.s3_bucket_name,
        Key=json_key,
        Body=json_content.encode("utf-8"),
        ContentType="application/json",
    )

    # Update index
    from app.models.puzzle import PuzzleMetadata
    puzzle = PuzzleMetadata(**puzzle_data)
    s3_service.update_puzzle_in_index(puzzle)

    return {
        "success": True,
        "puzzleId": puzzle_id,
        "message": "Puzzle updated successfully",
    }


@router.get("/calendar/{year}/{month}")
async def get_calendar(
    year: int,
    month: int,
    _: bool = Depends(verify_admin),
):
    """Get scheduled puzzles for a specific month."""
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Invalid month")

    s3_service = get_s3_service()
    schedule = s3_service.get_puzzles_for_month(year, month)
    index = s3_service.get_puzzle_index()

    # Build detailed info for each scheduled puzzle
    scheduled_puzzles = {}
    for date, puzzle_id in schedule.items():
        puzzle_info = next((p for p in index.puzzles if p.id == puzzle_id), None)
        if puzzle_info:
            scheduled_puzzles[date] = puzzle_info.model_dump()

    return {
        "year": year,
        "month": month,
        "schedule": scheduled_puzzles,
    }
