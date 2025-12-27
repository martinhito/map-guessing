"use client";

import { useState, useEffect, useCallback } from "react";
import { GameState, Attempt, GuessResponse, HintResponse } from "@/lib/types";
import {
  fetchPuzzle,
  submitGuess,
  fetchHint,
  fetchAttempts,
  fetchRevealedHints,
} from "@/lib/api";

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
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const puzzle = await fetchPuzzle();

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
