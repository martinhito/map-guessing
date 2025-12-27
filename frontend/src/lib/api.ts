import {
  PuzzleResponse,
  GuessResponse,
  HintResponse,
  AttemptsResponse,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PLAYER_ID_KEY = "map_guess_player_id";

// Get player ID from localStorage
function getPlayerId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PLAYER_ID_KEY);
}

// Store player ID in localStorage
function setPlayerId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLAYER_ID_KEY, id);
}

// Build headers with player ID
function getHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  const playerId = getPlayerId();
  if (playerId) {
    headers["X-Player-ID"] = playerId;
  }
  return headers;
}

// Check response for new player ID and store it
function checkForPlayerId(response: Response): void {
  const newPlayerId = response.headers.get("X-Player-ID");
  if (newPlayerId) {
    setPlayerId(newPlayerId);
  }
}

export async function fetchPuzzle(): Promise<PuzzleResponse> {
  const response = await fetch(`${API_BASE}/api/puzzle`, {
    credentials: "include",
    headers: getHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch puzzle");
  }
  checkForPlayerId(response);
  return response.json();
}

export async function fetchPuzzleById(puzzleId: string): Promise<PuzzleResponse> {
  const response = await fetch(`${API_BASE}/api/puzzle/${puzzleId}`, {
    credentials: "include",
    headers: getHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch puzzle");
  }
  checkForPlayerId(response);
  return response.json();
}

export async function submitGuess(
  puzzleId: string,
  guess: string
): Promise<GuessResponse> {
  const response = await fetch(`${API_BASE}/api/puzzle/${puzzleId}/guess`, {
    method: "POST",
    headers: getHeaders({ "Content-Type": "application/json" }),
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
    headers: getHeaders(),
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
    headers: getHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch hints");
  }
  return response.json();
}

export async function fetchAttempts(puzzleId: string): Promise<AttemptsResponse> {
  const response = await fetch(`${API_BASE}/api/puzzle/${puzzleId}/attempts`, {
    credentials: "include",
    headers: getHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch attempts");
  }
  return response.json();
}
