from pydantic import BaseModel, model_validator
from typing import List, Optional, Literal, Tuple


class AnswerVariant(BaseModel):
    """An answer variant with its embedding"""
    text: str
    embedding: List[float]


class GuidedHint(BaseModel):
    """A hint that triggers based on guess content and similarity score"""
    triggerWords: List[str]
    similarityRange: Tuple[float, float]  # [min, max]
    hint: str
    priority: int = 1


class PuzzleMetadata(BaseModel):
    """Puzzle data stored in S3"""
    id: str
    imageUrl: str
    answer: str
    maxGuesses: int = 5
    similarityThreshold: float = 0.95
    answerEmbedding: List[float]  # Keep for backwards compatibility
    answerEmbeddings: Optional[List[dict]] = None  # Raw from S3: [{text, embedding}, ...]
    answerVariants: Optional[List[AnswerVariant]] = None  # Parsed variants
    hints: Optional[List[str]] = None
    guidedHints: Optional[List[GuidedHint]] = None

    @model_validator(mode="after")
    def _populate_variants_from_embeddings(self) -> "PuzzleMetadata":
        """Map answerEmbeddings (from upload script) into answerVariants if not already set."""
        if not self.answerVariants and self.answerEmbeddings:
            self.answerVariants = [
                AnswerVariant(text=e["text"], embedding=e["embedding"])
                for e in self.answerEmbeddings
                if "text" in e and "embedding" in e
            ]
        return self
    # Similarity checking mode: "embedding" uses vector similarity, "llm" uses GPT-4o-mini
    similarityMode: Literal["embedding", "llm"] = "embedding"
    # Source attribution
    sourceText: Optional[str] = None  # e.g. "US Census Bureau"
    sourceUrl: Optional[str] = None  # Link to original data (shown after game ends)
    # New fields for dual game modes
    createdAt: Optional[str] = None  # ISO timestamp
    inEndlessPool: bool = False  # Whether puzzle is in endless mode pool
    scheduledDate: Optional[str] = None  # YYYY-MM-DD for daily mode


class PuzzleIndexEntry(BaseModel):
    """Summary info for a puzzle in the index"""
    id: str
    answer: str
    imageUrl: str
    createdAt: Optional[str] = None
    inEndlessPool: bool = False
    scheduledDate: Optional[str] = None


class PuzzleIndex(BaseModel):
    """Master index of all puzzles"""
    puzzles: List[PuzzleIndexEntry] = []
    dailySchedule: dict[str, str] = {}  # date -> puzzle_id
    endlessPool: List[str] = []  # list of puzzle_ids


class PuzzleResponse(BaseModel):
    """Public puzzle info (excludes answer and embedding)"""
    id: str
    imageUrl: str
    maxGuesses: int
    similarityThreshold: float
    prompt: str = "Guess what this map represents"
    hintsAvailable: int = 0
    sourceText: Optional[str] = None  # Always visible


class GuessRequest(BaseModel):
    guess: str


class GuessResponse(BaseModel):
    correct: bool
    gameOver: bool
    similarity: float
    remainingGuesses: int
    message: str
    answer: Optional[str] = None
    attemptsUsed: int
    sourceUrl: Optional[str] = None  # Only shown when game is over
    guidedHint: Optional[str] = None  # Free hint nudge, null if none triggered


class HintResponse(BaseModel):
    hintIndex: int
    hintText: str
    hintsRemaining: int
    remainingGuesses: Optional[int] = None  # Guesses left after hint (hints cost 1 guess)
    gameOver: bool = False  # True if this hint used the last guess


class PlayerStatsResponse(BaseModel):
    """Player statistics."""
    totalPlayed: int
    totalSolved: int
    successRate: float  # 0.0 - 1.0
    currentStreak: int
    maxStreak: int
    averageGuesses: float  # average guesses on solved puzzles
    guessDistribution: dict[int, int]  # {1: count, 2: count, ...}
    hintsUsed: int


class AttemptInfo(BaseModel):
    guess: str  # For hints, this is the hint text
    similarity: float  # 0 for hints
    correct: bool
    timestamp: str
    isHint: bool = False  # True if this is a hint, not a guess


class AttemptsResponse(BaseModel):
    attempts: List[AttemptInfo]
    gameState: Optional[dict] = None
    answer: Optional[str] = None  # Revealed when game is over
    sourceUrl: Optional[str] = None  # Revealed when game is over
