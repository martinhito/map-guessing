"use client";

import { CSSProperties, useEffect, useState } from "react";
import { Attempt } from "@/lib/types";

interface Props {
  solved: boolean;
  answer: string;
  attempts: Attempt[];
  maxGuesses: number;
  threshold: number;
  puzzleId: string;
  onClose: () => void;
}

export default function ResultModal({
  solved,
  answer,
  attempts,
  maxGuesses,
  threshold,
  puzzleId,
  onClose,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
  }, []);

  const generateShareText = () => {
    const emoji = solved ? getResultEmoji(attempts.length, maxGuesses) : "X";
    const header = `Can You Guess the Map? ${puzzleId} ${emoji}/${maxGuesses}`;

    const grid = attempts.map((attempt) => {
      const ratio = attempt.similarity / threshold;
      if (ratio >= 1) return "🟩";
      if (ratio >= 0.8) return "🟨";
      if (ratio >= 0.5) return "🟧";
      return "⬛";
    }).join("");

    return `${header}\n${grid}`;
  };

  const handleShare = async () => {
    const text = generateShareText();

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={{
          ...styles.modal,
          ...(animate ? styles.modalAnimated : {}),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button style={styles.closeBtn} onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Result header */}
        <div style={styles.resultHeader}>
          {solved ? (
            <>
              <div style={styles.successIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--correct)" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={styles.title}>Well done!</h2>
              <p style={styles.subtitle}>
                You got it in {attempts.length} {attempts.length === 1 ? "guess" : "guesses"}
              </p>
            </>
          ) : (
            <>
              <div style={styles.failIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <h2 style={styles.title}>Better luck next time</h2>
              <p style={styles.subtitle}>The answer was:</p>
            </>
          )}
        </div>

        {/* Answer reveal */}
        <div style={styles.answerBox}>
          <p style={styles.answer}>{answer}</p>
        </div>

        {/* Stats grid */}
        <div style={styles.statsGrid}>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{attempts.length}</span>
            <span style={styles.statLabel}>Guesses</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>
              {Math.min(Math.round((Math.max(...attempts.map((a) => a.similarity)) / threshold) * 100), 100)}%
            </span>
            <span style={styles.statLabel}>Best</span>
          </div>
        </div>

        {/* Guess visualization */}
        <div style={styles.guessViz}>
          {attempts.map((attempt, i) => {
            const ratio = attempt.similarity / threshold;
            let color = "var(--cold)";
            if (ratio >= 1) color = "var(--correct)";
            else if (ratio >= 0.8) color = "var(--close)";
            else if (ratio >= 0.5) color = "var(--warm)";

            return (
              <div
                key={i}
                style={{
                  ...styles.guessBlock,
                  backgroundColor: color,
                }}
                title={`${Math.round(attempt.similarity * 100)}%`}
              />
            );
          })}
          {/* Empty slots */}
          {Array.from({ length: maxGuesses - attempts.length }).map((_, i) => (
            <div key={`empty-${i}`} style={styles.guessBlockEmpty} />
          ))}
        </div>

        {/* Share button */}
        <button style={styles.shareBtn} onClick={handleShare}>
          {copied ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Share
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function getResultEmoji(guesses: number, max: number): string {
  if (guesses === 1) return "1";
  if (guesses === 2) return "2";
  if (guesses === 3) return "3";
  if (guesses === 4) return "4";
  if (guesses === 5) return "5";
  if (guesses === 6) return "6";
  return guesses.toString();
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    zIndex: 100,
  },
  modal: {
    backgroundColor: "var(--card-bg)",
    borderRadius: "16px",
    padding: "24px",
    maxWidth: "360px",
    width: "100%",
    position: "relative",
    opacity: 0,
    transform: "scale(0.9) translateY(20px)",
    transition: "all 0.3s ease-out",
  },
  modalAnimated: {
    opacity: 1,
    transform: "scale(1) translateY(0)",
  },
  closeBtn: {
    position: "absolute",
    top: "12px",
    right: "12px",
    background: "none",
    border: "none",
    color: "var(--muted)",
    padding: "4px",
    borderRadius: "4px",
  },
  resultHeader: {
    textAlign: "center",
    marginBottom: "20px",
  },
  successIcon: {
    marginBottom: "8px",
  },
  failIcon: {
    marginBottom: "8px",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    margin: "0 0 4px 0",
  },
  subtitle: {
    color: "var(--muted)",
    fontSize: "0.9375rem",
    margin: 0,
  },
  answerBox: {
    backgroundColor: "var(--background)",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "20px",
    textAlign: "center",
  },
  answer: {
    fontSize: "1.125rem",
    fontWeight: 600,
    margin: 0,
    lineHeight: 1.4,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
    marginBottom: "20px",
  },
  statItem: {
    textAlign: "center",
  },
  statValue: {
    display: "block",
    fontSize: "1.5rem",
    fontWeight: 700,
  },
  statLabel: {
    fontSize: "0.75rem",
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  guessViz: {
    display: "flex",
    gap: "4px",
    justifyContent: "center",
    marginBottom: "24px",
  },
  guessBlock: {
    width: "32px",
    height: "32px",
    borderRadius: "4px",
    transition: "transform 0.2s",
  },
  guessBlockEmpty: {
    width: "32px",
    height: "32px",
    borderRadius: "4px",
    border: "2px solid var(--border)",
    backgroundColor: "transparent",
  },
  shareBtn: {
    width: "100%",
    padding: "14px",
    backgroundColor: "var(--correct)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
};
