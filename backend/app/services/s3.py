import json
from datetime import datetime, timezone
from typing import Optional

import boto3
from botocore.exceptions import ClientError

from app.config import get_settings
from app.models.puzzle import PuzzleMetadata


class S3PuzzleService:
    """S3 client for fetching puzzle data."""

    ACTIVE_PUZZLE_KEY = "puzzles/active.json"

    def __init__(self):
        self.settings = get_settings()
        self.s3_client = boto3.client(
            "s3",
            region_name=self.settings.aws_region,
            aws_access_key_id=self.settings.aws_access_key_id,
            aws_secret_access_key=self.settings.aws_secret_access_key,
        )

    def get_puzzle(self, puzzle_id: Optional[str] = None) -> PuzzleMetadata:
        """Fetch puzzle from S3."""
        resolved_id = self._resolve_puzzle_id(puzzle_id)
        key = f"{self.settings.s3_puzzle_prefix}{resolved_id}.json"

        try:
            response = self.s3_client.get_object(
                Bucket=self.settings.s3_bucket_name,
                Key=key,
            )
            content = response["Body"].read().decode("utf-8")
            data = json.loads(content)
            return PuzzleMetadata(**data)
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                raise ValueError(f"Puzzle not found: {resolved_id}")
            raise

    def _resolve_puzzle_id(self, puzzle_id: Optional[str]) -> str:
        """Resolve puzzle ID - 'latest' or None checks active puzzle, then today's date."""
        if puzzle_id and puzzle_id.lower() not in ("latest", ""):
            return puzzle_id

        # Check for active puzzle override
        active_id = self.get_active_puzzle_id()
        if active_id:
            return active_id

        return self.get_today_puzzle_id()

    def get_today_puzzle_id(self) -> str:
        """Get today's puzzle ID based on UTC date."""
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def get_active_puzzle_id(self) -> Optional[str]:
        """Get the currently active puzzle ID from S3."""
        try:
            response = self.s3_client.get_object(
                Bucket=self.settings.s3_bucket_name,
                Key=self.ACTIVE_PUZZLE_KEY,
            )
            content = response["Body"].read().decode("utf-8")
            data = json.loads(content)
            return data.get("activePuzzleId")
        except ClientError:
            return None

    def set_active_puzzle_id(self, puzzle_id: Optional[str]) -> None:
        """Set the active puzzle ID in S3. Pass None to clear."""
        if puzzle_id:
            content = json.dumps({"activePuzzleId": puzzle_id})
            self.s3_client.put_object(
                Bucket=self.settings.s3_bucket_name,
                Key=self.ACTIVE_PUZZLE_KEY,
                Body=content.encode("utf-8"),
                ContentType="application/json",
            )
        else:
            # Clear active puzzle - delete the file
            try:
                self.s3_client.delete_object(
                    Bucket=self.settings.s3_bucket_name,
                    Key=self.ACTIVE_PUZZLE_KEY,
                )
            except ClientError:
                pass


# Singleton instance
_s3_service: S3PuzzleService | None = None


def get_s3_service() -> S3PuzzleService:
    global _s3_service
    if _s3_service is None:
        _s3_service = S3PuzzleService()
    return _s3_service
