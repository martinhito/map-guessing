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
}

export interface Attempt {
  guess: string;
  similarity: number;
  correct: boolean;
  timestamp: string;
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
