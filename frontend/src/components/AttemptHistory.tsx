"use client";

import { CSSProperties } from "react";
import { Attempt } from "@/lib/types";

interface Props {
  attempts: Attempt[];
}

const styles: Record<string, CSSProperties> = {
  container: {
    marginTop: "20px",
  },
  title: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "12px",
  },
  list: {
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    backgroundColor: "var(--card-bg)",
    borderRadius: "8px",
    border: "1px solid var(--border)",
  },
  itemCorrect: {
    borderColor: "var(--success)",
    backgroundColor: "rgba(22, 163, 74, 0.1)",
  },
  guess: {
    fontWeight: 500,
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginRight: "12px",
  },
  similarity: {
    fontWeight: 600,
    fontSize: "0.875rem",
    padding: "4px 10px",
    borderRadius: "4px",
    backgroundColor: "var(--background)",
  },
  empty: {
    color: "var(--muted)",
    fontSize: "0.875rem",
    fontStyle: "italic",
    textAlign: "center",
    padding: "20px",
  },
};

function getSimilarityColor(similarity: number): string {
  if (similarity >= 0.95) return "var(--success)";
  if (similarity >= 0.85) return "var(--warning)";
  if (similarity >= 0.7) return "#f97316";
  return "var(--muted)";
}

export default function AttemptHistory({ attempts }: Props) {
  if (attempts.length === 0) {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>Previous Guesses</h3>
        <p style={styles.empty}>No guesses yet. Give it a try!</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Previous Guesses ({attempts.length})</h3>
      <ul style={styles.list}>
        {attempts.map((attempt, index) => (
          <li
            key={index}
            style={{
              ...styles.item,
              ...(attempt.correct ? styles.itemCorrect : {}),
            }}
          >
            <span style={styles.guess}>{attempt.guess}</span>
            <span
              style={{
                ...styles.similarity,
                color: getSimilarityColor(attempt.similarity),
              }}
            >
              {Math.round(attempt.similarity * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
