"use client";

import { useState, useEffect, useCallback } from "react";
import { GameState, Attempt, GuessResponse, HintResponse, PuzzleResponse } from "@/lib/types";
import {
  fetchPuzzle,
  submitGuess,
  fetchHint,
  fetchAttempts,
  fetchRevealedHints,
} from "@/lib/api";

const CACHE_KEY = "map_guess_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedData {
  puzzle: PuzzleResponse;
  timestamp: number;
}

function getCachedPuzzle(): PuzzleResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data: CachedData = JSON.parse(cached);
    // Check if cache is still valid and same day
    const now = Date.now();
    const today = new Date().toISOString().split("T")[0];
    if (now - data.timestamp < CACHE_TTL && data.puzzle.id === today) {
      return data.puzzle;
    }
  } catch {
    // Invalid cache
  }
  return null;
}

function setCachedPuzzle(puzzle: PuzzleResponse): void {
  if (typeof window === "undefined") return;
  try {
    const data: CachedData = { puzzle, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable
  }
}

const initialState: GameState = {
  puzzle: null,
  attempts: [],
  hints: [],
  solved: false,
  gameOver: false,
  loading: true,
  error: null,
  answer: null,
};

export function useGame() {
  const [state, setState] = useState<GameState>(initialState);

  const loadPuzzle = useCallback(async () => {
    // Try to show cached puzzle immediately
    const cached = getCachedPuzzle();
    if (cached) {
      setState((prev) => ({ ...prev, puzzle: cached, loading: true }));
    } else {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }

    try {
      // Fetch puzzle (or use cached if valid)
      const puzzle = cached || await fetchPuzzle();
      if (!cached) {
        setCachedPuzzle(puzzle);
      }

      // Fetch existing attempts and hints for this puzzle
      const [attemptsData, hintsData] = await Promise.all([
        fetchAttempts(puzzle.id),
        fetchRevealedHints(puzzle.id),
      ]);

      const gameState = attemptsData.gameState;
      const isGameOver =
        gameState?.solved ||
        (gameState?.totalGuesses ?? 0) >= puzzle.maxGuesses;

      setState((prev) => ({
        ...prev,
        puzzle,
        attempts: attemptsData.attempts,
        hints: hintsData.hints,
        solved: gameState?.solved || false,
        gameOver: isGameOver,
        loading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load puzzle",
      }));
    }
  }, []);

  // Load puzzle on mount
  useEffect(() => {
    loadPuzzle();
  }, [loadPuzzle]);

  const makeGuess = useCallback(
    async (guess: string): Promise<GuessResponse | undefined> => {
      if (!state.puzzle || state.gameOver) return;

      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const result: GuessResponse = await submitGuess(state.puzzle.id, guess);

        const newAttempt: Attempt = {
          guess,
          similarity: result.similarity,
          correct: result.correct,
          timestamp: new Date().toISOString(),
        };

        setState((prev) => ({
          ...prev,
          attempts: [newAttempt, ...prev.attempts],
          solved: result.correct,
          gameOver: result.gameOver,
          answer: result.answer,
          loading: false,
        }));

        return result;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error ? error.message : "Failed to submit guess",
        }));
        return undefined;
      }
    },
    [state.puzzle, state.gameOver]
  );

  const revealHint = useCallback(async (): Promise<HintResponse | undefined> => {
    if (!state.puzzle) return;

    try {
      const hint: HintResponse = await fetchHint(state.puzzle.id);
      setState((prev) => ({
        ...prev,
        hints: [...prev.hints, hint.hintText],
      }));
      return hint;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to get hint",
      }));
    }
  }, [state.puzzle]);

  const remainingGuesses = state.puzzle
    ? state.puzzle.maxGuesses - state.attempts.length
    : 0;

  return {
    ...state,
    remainingGuesses,
    makeGuess,
    revealHint,
    loadPuzzle,
  };
}
