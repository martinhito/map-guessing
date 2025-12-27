"use client";

import { CSSProperties } from "react";

interface Props {
  hints: string[];
  hintsAvailable: number;
  onRevealHint: () => void;
  disabled: boolean;
}

const styles: Record<string, CSSProperties> = {
  container: {
    marginTop: "20px",
    padding: "16px",
    backgroundColor: "var(--card-bg)",
    borderRadius: "8px",
    border: "1px solid var(--border)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  title: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  button: {
    padding: "8px 16px",
    fontSize: "0.875rem",
    fontWeight: 500,
    backgroundColor: "transparent",
    color: "var(--primary)",
    border: "1px solid var(--primary)",
    borderRadius: "6px",
    transition: "all 0.2s",
  },
  buttonDisabled: {
    color: "var(--muted)",
    borderColor: "var(--border)",
    cursor: "not-allowed",
  },
  hintsList: {
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  hintItem: {
    padding: "10px 12px",
    backgroundColor: "var(--background)",
    borderRadius: "6px",
    fontSize: "0.9375rem",
  },
  hintNumber: {
    fontWeight: 600,
    color: "var(--primary)",
    marginRight: "8px",
  },
  noHints: {
    color: "var(--muted)",
    fontSize: "0.875rem",
    fontStyle: "italic",
  },
};

export default function HintPanel({
  hints,
  hintsAvailable,
  onRevealHint,
  disabled,
}: Props) {
  const hintsRemaining = hintsAvailable - hints.length;
  const canReveal = hintsRemaining > 0 && !disabled;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>
          Hints ({hints.length}/{hintsAvailable})
        </span>
        <button
          onClick={onRevealHint}
          disabled={!canReveal}
          style={{
            ...styles.button,
            ...(!canReveal ? styles.buttonDisabled : {}),
          }}
        >
          {hintsRemaining > 0 ? `Reveal Hint (${hintsRemaining} left)` : "No hints left"}
        </button>
      </div>
      {hints.length > 0 ? (
        <ul style={styles.hintsList}>
          {hints.map((hint, index) => (
            <li key={index} style={styles.hintItem}>
              <span style={styles.hintNumber}>#{index + 1}</span>
              {hint}
            </li>
          ))}
        </ul>
      ) : (
        <p style={styles.noHints}>No hints revealed yet</p>
      )}
    </div>
  );
}
