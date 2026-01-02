export interface PuzzleResponse {
  id: string;
  imageUrl: string;
  maxGuesses: number;
  similarityThreshold: number;
  prompt: string;
  hintsAvailable: number;
  sourceText: string | null;
}

export interface GuessResponse {
  correct: boolean;
  gameOver: boolean;
  similarity: number;
  remainingGuesses: number;
  message: string;
  answer: string | null;
  attemptsUsed: number;
  sourceUrl: string | null;
}

export interface HintResponse {
  hintIndex: number;
  hintText: string;
  hintsRemaining: number;
  remainingGuesses?: number;  // Guesses left after hint (hints cost 1 guess)
  gameOver?: boolean;  // True if this hint used the last guess
}

export interface Attempt {
  guess: string;  // For hints, this is the hint text
  similarity: number;  // 0 for hints
  correct: boolean;
  timestamp: string;
  isHint?: boolean;  // True if this is a hint, not a guess
}

export interface GameStateResponse {
  solved: boolean;
  totalGuesses: number;
  hintsRevealed: number;
}

export interface AttemptsResponse {
  attempts: Attempt[];
  gameState: GameStateResponse | null;
  answer: string | null;
  sourceUrl: string | null;
}

export interface GameState {
  puzzle: PuzzleResponse | null;
  attempts: Attempt[];
  hints: string[];
  solved: boolean;
  gameOver: boolean;
  loading: boolean;
  error: string | null;
  answer: string | null;
  sourceUrl: string | null;
}
