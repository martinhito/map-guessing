"use client";

import { CSSProperties } from "react";

interface Props {
  hints: string[];
  hintsAvailable: number;
  onRevealHint: () => void;
  disabled: boolean;
}

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
        <div style={styles.headerLeft}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span style={styles.title}>Hints</span>
          <span style={styles.count}>
            {hints.length}/{hintsAvailable}
          </span>
        </div>
        {hintsRemaining > 0 && (
          <button
            onClick={onRevealHint}
            disabled={!canReveal}
            style={{
              ...styles.button,
              ...(!canReveal ? styles.buttonDisabled : {}),
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Reveal
          </button>
        )}
      </div>

      {hints.length > 0 ? (
        <div style={styles.hintsList}>
          {hints.map((hint, index) => (
            <div key={index} style={styles.hintItem}>
              <span style={styles.hintNumber}>{index + 1}</span>
              <span style={styles.hintText}>{hint}</span>
            </div>
          ))}
        </div>
      ) : (
        <p style={styles.noHints}>
          {hintsRemaining > 0
            ? "Click reveal to get a hint"
            : "No hints available for this puzzle"}
        </p>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    width: "100%",
    padding: "16px",
    backgroundColor: "var(--card-bg)",
    borderRadius: "12px",
    border: "2px solid var(--border)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "var(--muted)",
  },
  title: {
    fontSize: "0.8125rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  count: {
    fontSize: "0.75rem",
    padding: "2px 6px",
    backgroundColor: "var(--border)",
    borderRadius: "4px",
  },
  button: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    fontSize: "0.8125rem",
    fontWeight: 600,
    backgroundColor: "var(--close)",
    color: "white",
    border: "none",
    borderRadius: "6px",
    transition: "background-color 0.2s",
  },
  buttonDisabled: {
    backgroundColor: "var(--muted)",
    cursor: "not-allowed",
  },
  hintsList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  hintItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "10px 12px",
    backgroundColor: "var(--background)",
    borderRadius: "8px",
  },
  hintNumber: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    fontSize: "0.6875rem",
    fontWeight: 700,
    backgroundColor: "var(--close)",
    color: "white",
    borderRadius: "50%",
    flexShrink: 0,
  },
  hintText: {
    fontSize: "0.9375rem",
    lineHeight: 1.4,
  },
  noHints: {
    color: "var(--muted)",
    fontSize: "0.875rem",
    textAlign: "center",
    padding: "8px 0",
    margin: 0,
  },
};
