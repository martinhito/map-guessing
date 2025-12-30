import json
from datetime import datetime, timezone
from typing import Optional, Dict
import time

import boto3
from botocore.exceptions import ClientError

from app.config import get_settings
from app.models.puzzle import PuzzleMetadata, PuzzleIndex, PuzzleIndexEntry


class S3PuzzleService:
    """S3 client for fetching puzzle data."""

    ACTIVE_PUZZLE_KEY = "puzzles/active.json"
    INDEX_KEY = "puzzles/index.json"
    CACHE_TTL = 300  # 5 minutes

    def __init__(self):
        self.settings = get_settings()
        self.s3_client = boto3.client(
            "s3",
            region_name=self.settings.aws_region,
            aws_access_key_id=self.settings.aws_access_key_id,
            aws_secret_access_key=self.settings.aws_secret_access_key,
        )
        self._puzzle_cache: Dict[str, tuple[PuzzleMetadata, float]] = {}

    def get_puzzle(self, puzzle_id: Optional[str] = None) -> PuzzleMetadata:
        """Fetch puzzle from S3 with caching."""
        resolved_id = self._resolve_puzzle_id(puzzle_id)

        # Check cache
        if resolved_id in self._puzzle_cache:
            cached_puzzle, cached_time = self._puzzle_cache[resolved_id]
            if time.time() - cached_time < self.CACHE_TTL:
                return cached_puzzle

        key = f"{self.settings.s3_puzzle_prefix}{resolved_id}.json"

        try:
            response = self.s3_client.get_object(
                Bucket=self.settings.s3_bucket_name,
                Key=key,
            )
            content = response["Body"].read().decode("utf-8")
            data = json.loads(content)
            puzzle = PuzzleMetadata(**data)

            # Cache the result
            self._puzzle_cache[resolved_id] = (puzzle, time.time())

            return puzzle
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

    # --- Index Management Methods ---

    def get_puzzle_index(self) -> PuzzleIndex:
        """Get the master puzzle index from S3."""
        try:
            response = self.s3_client.get_object(
                Bucket=self.settings.s3_bucket_name,
                Key=self.INDEX_KEY,
            )
            content = response["Body"].read().decode("utf-8")
            data = json.loads(content)
            return PuzzleIndex(**data)
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                return PuzzleIndex()
            raise

    def save_puzzle_index(self, index: PuzzleIndex) -> None:
        """Save the puzzle index to S3."""
        content = json.dumps(index.model_dump(), indent=2)
        self.s3_client.put_object(
            Bucket=self.settings.s3_bucket_name,
            Key=self.INDEX_KEY,
            Body=content.encode("utf-8"),
            ContentType="application/json",
        )

    def add_puzzle_to_index(self, puzzle: PuzzleMetadata) -> None:
        """Add or update a puzzle in the index."""
        index = self.get_puzzle_index()

        entry = PuzzleIndexEntry(
            id=puzzle.id,
            answer=puzzle.answer,
            imageUrl=puzzle.imageUrl,
            createdAt=puzzle.createdAt,
            inEndlessPool=puzzle.inEndlessPool,
            scheduledDate=puzzle.scheduledDate,
        )

        # Update or add the puzzle entry
        found = False
        for i, p in enumerate(index.puzzles):
            if p.id == puzzle.id:
                index.puzzles[i] = entry
                found = True
                break
        if not found:
            index.puzzles.append(entry)

        # Update endless pool list
        if puzzle.inEndlessPool and puzzle.id not in index.endlessPool:
            index.endlessPool.append(puzzle.id)
        elif not puzzle.inEndlessPool and puzzle.id in index.endlessPool:
            index.endlessPool.remove(puzzle.id)

        # Update daily schedule
        if puzzle.scheduledDate:
            index.dailySchedule[puzzle.scheduledDate] = puzzle.id
        else:
            # Remove from any date it might be scheduled
            index.dailySchedule = {
                date: pid for date, pid in index.dailySchedule.items()
                if pid != puzzle.id
            }

        self.save_puzzle_index(index)

    def update_puzzle_in_index(self, puzzle: PuzzleMetadata) -> None:
        """Update a puzzle in the index (alias for add_puzzle_to_index)."""
        # Invalidate cache first
        if puzzle.id in self._puzzle_cache:
            del self._puzzle_cache[puzzle.id]
        self.add_puzzle_to_index(puzzle)

    def toggle_endless_pool(self, puzzle_id: str, in_pool: bool) -> PuzzleMetadata:
        """Toggle a puzzle's endless pool membership."""
        puzzle = self.get_puzzle(puzzle_id)
        puzzle.inEndlessPool = in_pool

        # Update puzzle file
        self._save_puzzle(puzzle)

        # Update index
        index = self.get_puzzle_index()
        for p in index.puzzles:
            if p.id == puzzle_id:
                p.inEndlessPool = in_pool
                break

        if in_pool and puzzle_id not in index.endlessPool:
            index.endlessPool.append(puzzle_id)
        elif not in_pool and puzzle_id in index.endlessPool:
            index.endlessPool.remove(puzzle_id)

        self.save_puzzle_index(index)

        # Invalidate cache
        if puzzle_id in self._puzzle_cache:
            del self._puzzle_cache[puzzle_id]

        return puzzle

    def schedule_puzzle(self, puzzle_id: str, date: Optional[str]) -> PuzzleMetadata:
        """Schedule or unschedule a puzzle for a specific date."""
        puzzle = self.get_puzzle(puzzle_id)
        old_date = puzzle.scheduledDate
        puzzle.scheduledDate = date

        # Update puzzle file
        self._save_puzzle(puzzle)

        # Update index
        index = self.get_puzzle_index()
        for p in index.puzzles:
            if p.id == puzzle_id:
                p.scheduledDate = date
                break

        # Remove from old date if any
        if old_date and old_date in index.dailySchedule:
            if index.dailySchedule[old_date] == puzzle_id:
                del index.dailySchedule[old_date]

        # Add to new date if specified
        if date:
            index.dailySchedule[date] = puzzle_id

        self.save_puzzle_index(index)

        # Invalidate cache
        if puzzle_id in self._puzzle_cache:
            del self._puzzle_cache[puzzle_id]

        return puzzle

    def _save_puzzle(self, puzzle: PuzzleMetadata) -> None:
        """Save a puzzle's metadata back to S3."""
        key = f"{self.settings.s3_puzzle_prefix}{puzzle.id}.json"
        content = json.dumps(puzzle.model_dump(), indent=2)
        self.s3_client.put_object(
            Bucket=self.settings.s3_bucket_name,
            Key=key,
            Body=content.encode("utf-8"),
            ContentType="application/json",
        )

    def get_puzzles_for_month(self, year: int, month: int) -> Dict[str, str]:
        """Get puzzle schedule for a specific month. Returns dict of date -> puzzle_id."""
        index = self.get_puzzle_index()
        prefix = f"{year}-{month:02d}"
        return {
            date: pid for date, pid in index.dailySchedule.items()
            if date.startswith(prefix)
        }

    def get_endless_pool_puzzles(self) -> list[PuzzleIndexEntry]:
        """Get all puzzles in the endless pool."""
        index = self.get_puzzle_index()
        return [p for p in index.puzzles if p.inEndlessPool]

    def get_all_puzzles(self) -> list[PuzzleIndexEntry]:
        """Get all puzzles from the index."""
        index = self.get_puzzle_index()
        return index.puzzles


# Singleton instance
_s3_service: S3PuzzleService | None = None


def get_s3_service() -> S3PuzzleService:
    global _s3_service
    if _s3_service is None:
        _s3_service = S3PuzzleService()
    return _s3_service
