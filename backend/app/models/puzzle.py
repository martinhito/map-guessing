from pydantic import BaseModel
from typing import List, Optional


class AnswerVariant(BaseModel):
    """An answer variant with its embedding"""
    text: str
    embedding: List[float]


class PuzzleMetadata(BaseModel):
    """Puzzle data stored in S3"""
    id: str
    imageUrl: str
    answer: str
    maxGuesses: int = 5
    similarityThreshold: float = 0.95
    answerEmbedding: List[float]  # Keep for backwards compatibility
    answerVariants: Optional[List[AnswerVariant]] = None  # New: synonyms with embeddings
    hints: Optional[List[str]] = None
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


class HintResponse(BaseModel):
    hintIndex: int
    hintText: str
    hintsRemaining: int


class AttemptInfo(BaseModel):
    guess: str
    similarity: float
    correct: bool
    timestamp: str


class AttemptsResponse(BaseModel):
    attempts: List[AttemptInfo]
    gameState: Optional[dict] = None
