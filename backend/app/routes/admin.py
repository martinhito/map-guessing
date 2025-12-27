import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Header
from pydantic import BaseModel

from app.config import get_settings
from app.services.embedding import get_embedding_service, EmbeddingService
from app.services.s3 import get_s3_service, S3PuzzleService

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Simple password authentication
ADMIN_PASSWORD = "sydneyannerocks123"


def verify_admin(x_admin_password: Optional[str] = Header(None)):
    """Verify admin password from header."""
    if x_admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin password")
    return True


class PuzzleCreateRequest(BaseModel):
    answer: str
    hints: list[str] = []
    date: Optional[str] = None  # YYYY-MM-DD format
    maxGuesses: int = 6
    similarityThreshold: float = 0.95


class PuzzleCreateResponse(BaseModel):
    success: bool
    puzzleId: str
    imageUrl: str
    message: str


@router.post("/verify")
async def verify_password(x_admin_password: Optional[str] = Header(None)):
    """Verify admin password."""
    if x_admin_password == ADMIN_PASSWORD:
        return {"valid": True}
    return {"valid": False}


@router.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    date: str = Form(None),
    _: bool = Depends(verify_admin),
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

    # Upload to S3
    import boto3
    s3_client = boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )

    image_key = f"{settings.s3_puzzle_prefix}images/{puzzle_date}{extension}"

    s3_client.put_object(
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
    date: str = Form(None),
    maxGuesses: int = Form(6),
    similarityThreshold: float = Form(0.95),
    _: bool = Depends(verify_admin),
    embedding_service: EmbeddingService = Depends(get_embedding_service),
):
    """Create a puzzle with the given image and answer."""
    settings = get_settings()

    # Determine puzzle date
    puzzle_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Parse hints (comma-separated)
    hints_list = [h.strip() for h in hints.split(",") if h.strip()] if hints else []

    # Calculate embedding for the answer
    answer_embedding = await embedding_service.embed(answer)

    # Create puzzle metadata
    puzzle_data = {
        "id": puzzle_date,
        "imageUrl": imageUrl,
        "answer": answer,
        "maxGuesses": maxGuesses,
        "similarityThreshold": similarityThreshold,
        "answerEmbedding": answer_embedding,
        "hints": hints_list if hints_list else None,
    }

    # Upload to S3
    import boto3
    s3_client = boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )

    json_key = f"{settings.s3_puzzle_prefix}{puzzle_date}.json"
    json_content = json.dumps(puzzle_data, indent=2)

    s3_client.put_object(
        Bucket=settings.s3_bucket_name,
        Key=json_key,
        Body=json_content.encode("utf-8"),
        ContentType="application/json",
    )

    return PuzzleCreateResponse(
        success=True,
        puzzleId=puzzle_date,
        imageUrl=imageUrl,
        message=f"Puzzle created successfully for {puzzle_date}",
    )


@router.get("/puzzles")
async def list_puzzles(
    _: bool = Depends(verify_admin),
):
    """List all available puzzles."""
    settings = get_settings()

    import boto3
    s3_client = boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )

    try:
        response = s3_client.list_objects_v2(
            Bucket=settings.s3_bucket_name,
            Prefix=settings.s3_puzzle_prefix,
        )

        puzzles = []
        for obj in response.get("Contents", []):
            key = obj["Key"]
            if key.endswith(".json"):
                puzzle_id = key.replace(settings.s3_puzzle_prefix, "").replace(".json", "")
                puzzles.append({
                    "id": puzzle_id,
                    "lastModified": obj["LastModified"].isoformat(),
                })

        # Sort by ID (date) descending
        puzzles.sort(key=lambda x: x["id"], reverse=True)

        return {"puzzles": puzzles}
    except Exception as e:
        return {"puzzles": [], "error": str(e)}
