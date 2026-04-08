#!/usr/bin/env python3
"""
Puzzle Upload Script

Upload map puzzles to S3 with pre-calculated embeddings.

Usage:
    python upload_puzzle.py --image path/to/map.png --answer "Description of what the map shows" --hints "Hint 1" "Hint 2"

Environment variables required:
    - OPENAI_API_KEY
    - AWS_ACCESS_KEY_ID
    - AWS_SECRET_ACCESS_KEY
    - S3_BUCKET_NAME
    - AWS_REGION (optional, defaults to us-east-1)
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import boto3
import httpx


def get_embedding(text: str, api_key: str, model: str = "text-embedding-3-small") -> list[float]:
    """Get embedding from OpenAI API."""
    response = httpx.post(
        "https://api.openai.com/v1/embeddings",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "input": text,
        },
        timeout=30.0,
    )
    response.raise_for_status()
    data = response.json()
    return data["data"][0]["embedding"]


def upload_to_s3(
    s3_client,
    bucket: str,
    key: str,
    content: bytes | str,
    content_type: str,
) -> str:
    """Upload content to S3 and return the URL."""
    if isinstance(content, str):
        content = content.encode("utf-8")

    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=content,
        ContentType=content_type,
    )

    region = s3_client.meta.region_name
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def update_puzzle_index(s3_client, bucket: str, prefix: str, puzzle_data: dict) -> None:
    """Add or update a puzzle entry in the master index (puzzles/index.json)."""
    index_key = f"{prefix}index.json"

    # Fetch existing index
    try:
        response = s3_client.get_object(Bucket=bucket, Key=index_key)
        index = json.loads(response["Body"].read().decode("utf-8"))
    except s3_client.exceptions.NoSuchKey:
        index = {"puzzles": [], "endlessPool": [], "dailySchedule": {}}
    except Exception:
        index = {"puzzles": [], "endlessPool": [], "dailySchedule": {}}

    entry = {
        "id": puzzle_data["id"],
        "answer": puzzle_data["answer"],
        "imageUrl": puzzle_data["imageUrl"],
        "createdAt": puzzle_data.get("createdAt", ""),
        "inEndlessPool": puzzle_data.get("inEndlessPool", False),
        "scheduledDate": puzzle_data.get("scheduledDate"),
    }

    # Update or append
    puzzles = index.get("puzzles", [])
    for i, p in enumerate(puzzles):
        if p.get("id") == entry["id"]:
            puzzles[i] = entry
            break
    else:
        puzzles.append(entry)
    index["puzzles"] = puzzles

    # Persist
    s3_client.put_object(
        Bucket=bucket,
        Key=index_key,
        Body=json.dumps(index, indent=2).encode("utf-8"),
        ContentType="application/json",
    )
    print(f"Index updated: {index_key}")


def main():
    parser = argparse.ArgumentParser(description="Upload a map puzzle to S3")
    parser.add_argument("--image", required=True, help="Path to the map image file")
    parser.add_argument("--answer", required=True, help="The correct answer for the puzzle")
    parser.add_argument("--hints", nargs="*", default=[], help="Optional hints")
    parser.add_argument("--date", help="Puzzle date (YYYY-MM-DD), defaults to today")
    parser.add_argument("--max-guesses", type=int, default=6, help="Maximum number of guesses")
    parser.add_argument("--threshold", type=float, default=0.95, help="Similarity threshold (0-1)")
    parser.add_argument("--prefix", default="puzzles/", help="S3 prefix for puzzle files")

    args = parser.parse_args()

    # Validate environment variables
    required_env = ["OPENAI_API_KEY", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BUCKET_NAME"]
    missing = [var for var in required_env if not os.environ.get(var)]
    if missing:
        print(f"Error: Missing environment variables: {', '.join(missing)}")
        sys.exit(1)

    openai_api_key = os.environ["OPENAI_API_KEY"]
    bucket_name = os.environ["S3_BUCKET_NAME"]
    region = os.environ.get("AWS_REGION", "us-east-1")

    # Validate image file
    image_path = Path(args.image)
    if not image_path.exists():
        print(f"Error: Image file not found: {args.image}")
        sys.exit(1)

    # Determine puzzle date
    puzzle_date = args.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    print(f"Uploading puzzle for date: {puzzle_date}")
    print(f"Answer: {args.answer}")
    print(f"Hints: {args.hints}")

    # Initialize S3 client
    s3_client = boto3.client(
        "s3",
        region_name=region,
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )

    # Upload image
    print("Uploading image to S3...")
    image_extension = image_path.suffix.lower()
    content_type = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }.get(image_extension, "application/octet-stream")

    image_key = f"{args.prefix}images/{puzzle_date}{image_extension}"
    image_content = image_path.read_bytes()
    image_url = upload_to_s3(s3_client, bucket_name, image_key, image_content, content_type)
    print(f"Image uploaded: {image_url}")

    # Calculate embedding for answer
    print("Calculating embedding for answer...")
    answer_embedding = get_embedding(args.answer, openai_api_key)
    print(f"Embedding calculated ({len(answer_embedding)} dimensions)")

    # Create puzzle metadata
    created_at = datetime.now(timezone.utc).isoformat()
    puzzle_data = {
        "id": puzzle_date,
        "imageUrl": image_url,
        "answer": args.answer,
        "maxGuesses": args.max_guesses,
        "similarityThreshold": args.threshold,
        "answerEmbedding": answer_embedding,
        "hints": args.hints if args.hints else None,
        "createdAt": created_at,
        "inEndlessPool": False,
        "scheduledDate": None,
    }

    # Upload puzzle JSON
    print("Uploading puzzle metadata to S3...")
    json_key = f"{args.prefix}{puzzle_date}.json"
    json_content = json.dumps(puzzle_data, indent=2)
    json_url = upload_to_s3(s3_client, bucket_name, json_key, json_content, "application/json")
    print(f"Metadata uploaded: {json_url}")

    # Update the master index so this puzzle appears in the admin UI
    print("Updating puzzle index...")
    update_puzzle_index(s3_client, bucket_name, args.prefix, puzzle_data)

    print("\nPuzzle uploaded successfully!")
    print(f"  Puzzle ID: {puzzle_date}")
    print(f"  Image URL: {image_url}")
    print(f"  Metadata: {json_url}")


if __name__ == "__main__":
    main()
