"use client";

import { CSSProperties } from "react";

interface Props {
  puzzleId: string;
  remainingGuesses: number;
  threshold: number;
  solved: boolean;
  gameOver: boolean;
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  badge: {
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "0.8125rem",
    fontWeight: 500,
    backgroundColor: "var(--card-bg)",
    border: "1px solid var(--border)",
  },
  badgeSuccess: {
    backgroundColor: "rgba(22, 163, 74, 0.15)",
    borderColor: "var(--success)",
    color: "var(--success)",
  },
  badgeWarning: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "var(--warning)",
    color: "var(--warning)",
  },
  badgeError: {
    backgroundColor: "rgba(220, 38, 38, 0.15)",
    borderColor: "var(--error)",
    color: "var(--error)",
  },
};

export default function GameStatus({
  puzzleId,
  remainingGuesses,
  threshold,
  solved,
  gameOver,
}: Props) {
  return (
    <div style={styles.container}>
      <span style={styles.badge}>Puzzle: {puzzleId}</span>
      <span style={styles.badge}>Target: {Math.round(threshold * 100)}%</span>
      <span
        style={{
          ...styles.badge,
          ...(solved
            ? styles.badgeSuccess
            : remainingGuesses <= 2
            ? styles.badgeWarning
            : {}),
          ...(gameOver && !solved ? styles.badgeError : {}),
        }}
      >
        {solved
          ? "Solved!"
          : gameOver
          ? "Game Over"
          : `${remainingGuesses} guesses left`}
      </span>
    </div>
  );
}
