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
    maxGuesses: int = 6
    similarityThreshold: float = 0.95
    answerEmbedding: List[float]  # Keep for backwards compatibility
    answerVariants: Optional[List[AnswerVariant]] = None  # New: synonyms with embeddings
    hints: Optional[List[str]] = None


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
