import {
  PuzzleResponse,
  GuessResponse,
  HintResponse,
  AttemptsResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchPuzzle(): Promise<PuzzleResponse> {
  const response = await fetch(`${API_BASE}/api/puzzle`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch puzzle");
  }
  return response.json();
}

export async function fetchPuzzleById(puzzleId: string): Promise<PuzzleResponse> {
  const response = await fetch(`${API_BASE}/api/puzzle/${puzzleId}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch puzzle");
  }
  return response.json();
}

export async function submitGuess(
  puzzleId: string,
  guess: string
): Promise<GuessResponse> {
  const response = await fetch(`${API_BASE}/api/puzzle/${puzzleId}/guess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ guess }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to submit guess");
  }
  return response.json();
}

export async function fetchHint(puzzleId: string): Promise<HintResponse> {
  const response = await fetch(`${API_BASE}/api/puzzle/${puzzleId}/hint`, {
    credentials: "include",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to fetch hint");
  }
  return response.json();
}

export async function fetchRevealedHints(
  puzzleId: string
): Promise<{ hints: string[]; hintsRemaining: number }> {
  const response = await fetch(`${API_BASE}/api/puzzle/${puzzleId}/hints`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch hints");
  }
  return response.json();
}

export async function fetchAttempts(puzzleId: string): Promise<AttemptsResponse> {
  const response = await fetch(`${API_BASE}/api/puzzle/${puzzleId}/attempts`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch attempts");
  }
  return response.json();
}
