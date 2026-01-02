"use client";

import { useState } from "react";
import { useGame } from "@/hooks/useGame";
import MapDisplay from "@/components/MapDisplay";
import GuessInput from "@/components/GuessInput";
import ResultModal from "@/components/ResultModal";
import HelpModal from "@/components/HelpModal";

export default function GameClient() {
  const {
    puzzle,
    attempts,
    hints,
    solved,
    gameOver,
    loading,
    error,
    answer,
    sourceUrl,
    remainingGuesses,
    makeGuess,
    revealHint,
  } = useGame();

  const [inputValue, setInputValue] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [shakeInput, setShakeInput] = useState(false);
  const [sourceRevealed, setSourceRevealed] = useState(false);

  const handleSubmit = async () => {
    if (!inputValue.trim() || gameOver) return;

    const result = await makeGuess(inputValue.trim());
    if (result) {
      setInputValue("");
      if (result.correct || remainingGuesses <= 1) {
        setTimeout(() => setShowResult(true), 500);
      }
    }
  };

  const headerContent = (
    <header style={styles.header}>
      <div style={styles.headerContent}>
        <div style={styles.headerSpacer} />
        <div style={styles.headerCenter}>
          <h1 style={styles.title}>Can You Guess the Map?</h1>
          <p style={styles.tagline}>A daily map guessing game</p>
        </div>
        <div style={styles.headerRight}>
          <button
            style={styles.helpBtn}
            onClick={() => setShowHelp(true)}
            aria-label="How to play"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <circle cx="12" cy="17" r="0.5" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );

  if (loading && !puzzle) {
    return (
      <div style={styles.page}>
        {headerContent}
        <main style={styles.main}>
          <div style={styles.loading}>
            <div style={styles.spinner} />
          </div>
        </main>
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      </div>
    );
  }

  if (error && !puzzle) {
    return (
      <div style={styles.page}>
        {headerContent}
        <main style={styles.main}>
          <div style={styles.errorBox}>{error}</div>
        </main>
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div style={styles.page}>
        {headerContent}
        <main style={styles.main}>
          <div style={styles.errorBox}>No puzzle available today</div>
        </main>
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      </div>
    );
  }

  const maxGuesses = puzzle.maxGuesses || 5;

  return (
    <div style={styles.page}>
      {headerContent}

      {/* Main game area */}
      <main style={styles.main}>
        {/* Map */}
        <MapDisplay imageUrl={puzzle.imageUrl} puzzleId={puzzle.id} />

        {/* Source attribution - revealable */}
        {puzzle.sourceText && (
          <div style={styles.sourceAttribution}>
            {sourceRevealed ? (
              <>
                Source: {puzzle.sourceText}
                {gameOver && sourceUrl && (
                  <> — <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>View data</a></>
                )}
              </>
            ) : (
              <button
                onClick={() => setSourceRevealed(true)}
                style={styles.sourceRevealBtn}
              >
                Tap to reveal source
              </button>
            )}
          </div>
        )}

        {/* Wordle-style guess board */}
        <div style={styles.guessBoard}>
          {Array.from({ length: maxGuesses }).map((_, i) => {
            // Attempts are stored newest-first, we display oldest-first (top to bottom)
            const attemptIndex = attempts.length - 1 - i;
            const attempt = attemptIndex >= 0 ? attempts[attemptIndex] : null;
            const isCurrentRow = i === attempts.length && !gameOver;

            if (attempt) {
              // Check if this is a hint
              if (attempt.isHint) {
                return (
                  <div
                    key={i}
                    style={{
                      ...styles.guessRow,
                      ...styles.guessRowFilled,
                      backgroundColor: "var(--hint)",
                      borderColor: "var(--hint)",
                    }}
                  >
                    <span style={styles.guessRowText}>
                      <span style={{ opacity: 0.8, marginRight: "8px" }}>💡</span>
                      {attempt.guess}
                    </span>
                    <span style={styles.guessRowLabel}>HINT</span>
                  </div>
                );
              }

              // Filled row - show the guess with color
              const ratio = attempt.similarity / puzzle.similarityThreshold;
              return (
                <div
                  key={i}
                  style={{
                    ...styles.guessRow,
                    ...styles.guessRowFilled,
                    backgroundColor: getSlotColor(attempt.similarity, puzzle.similarityThreshold),
                    borderColor: getSlotColor(attempt.similarity, puzzle.similarityThreshold),
                  }}
                >
                  <span style={styles.guessRowText}>{attempt.guess}</span>
                  <span style={styles.guessRowRight}>
                    <span style={styles.guessRowLabel}>
                      {getLabel(attempt.similarity, puzzle.similarityThreshold)}
                    </span>
                    <span style={styles.guessRowPercent}>
                      {Math.min(Math.round(ratio * 100), 100)}%
                    </span>
                  </span>
                </div>
              );
            }

            if (isCurrentRow) {
              // Current input row
              return (
                <div key={i} style={{ width: "100%" }} className={shakeInput ? "animate-shake" : ""}>
                  <GuessInput
                    value={inputValue}
                    onChange={setInputValue}
                    onSubmit={handleSubmit}
                    disabled={gameOver || loading}
                    loading={loading}
                    placeholder="What does this map show?"
                    hintsAvailable={puzzle.hintsAvailable}
                    hintsUsed={hints.length}
                    onRevealHint={revealHint}
                  />
                </div>
              );
            }

            // Empty row
            return (
              <div key={i} style={styles.guessRow}>
                <span style={styles.guessRowEmpty}>&nbsp;</span>
              </div>
            );
          })}
        </div>

      </main>

      {/* Result modal */}
      {showResult && (
        <ResultModal
          solved={solved}
          answer={answer || ""}
          attempts={attempts}
          maxGuesses={maxGuesses}
          threshold={puzzle.similarityThreshold}
          puzzleId={puzzle.id}
          imageUrl={puzzle.imageUrl}
          sourceText={puzzle.sourceText}
          sourceUrl={sourceUrl}
          onClose={() => setShowResult(false)}
        />
      )}

      {/* Show result button if game is over but modal was closed */}
      {gameOver && !showResult && (
        <button
          onClick={() => setShowResult(true)}
          style={styles.showResultBtn}
        >
          Share Results
        </button>
      )}

      {/* Help modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* Debug button - only on localhost */}
      {typeof window !== "undefined" && window.location.hostname === "localhost" && (
        <button
          onClick={async () => {
            if (puzzle) {
              await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/puzzle/${puzzle.id}/reset`, {
                method: "POST",
                credentials: "include",
              });
              window.location.reload();
            }
          }}
          style={styles.debugBtn}
        >
          Reset Game (Debug)
        </button>
      )}
    </div>
  );
}

function getSlotColor(similarity: number, threshold: number): string {
  const ratio = similarity / threshold;
  if (ratio >= 1) return "var(--correct)";   // Green
  if (ratio >= 0.70) return "var(--close)";  // Yellow
  if (ratio >= 0.45) return "var(--warm)";   // Orange
  return "var(--cold)";                       // Red
}

function getLabel(similarity: number, threshold: number): string {
  const ratio = similarity / threshold;
  if (ratio >= 1) return "Correct!";
  if (ratio >= 0.85) return "Very Close";
  if (ratio >= 0.70) return "Close";
  if (ratio >= 0.55) return "On Track";
  if (ratio >= 0.40) return "Getting There";
  return "Way Off";
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "12px 16px",
    borderBottom: "1px solid var(--header-border)",
    backgroundColor: "var(--header-bg)",
  },
  headerContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: "600px",
    margin: "0 auto",
  },
  headerSpacer: {
    width: "40px",
  },
  headerCenter: {
    textAlign: "center",
    flex: 1,
  },
  headerRight: {
    width: "40px",
    display: "flex",
    justifyContent: "flex-end",
  },
  helpBtn: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    padding: "4px",
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
    margin: 0,
  },
  tagline: {
    fontSize: "0.75rem",
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    marginTop: "2px",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "16px",
    gap: "16px",
    maxWidth: "600px",
    width: "100%",
    margin: "0 auto",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid var(--border)",
    borderTopColor: "var(--correct)",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  errorBox: {
    padding: "20px",
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    border: "1px solid var(--error)",
    borderRadius: "8px",
    color: "var(--error)",
    textAlign: "center",
  },
  guessBoard: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    width: "100%",
  },
  guessRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderRadius: "8px",
    border: "2px solid var(--border)",
    backgroundColor: "var(--card-bg)",
    minHeight: "52px",
  },
  guessRowFilled: {
    color: "white",
  },
  guessRowText: {
    fontSize: "0.9375rem",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
  },
  guessRowRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
  guessRowLabel: {
    fontSize: "0.6875rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    opacity: 0.9,
  },
  guessRowPercent: {
    fontSize: "0.8125rem",
    fontWeight: 700,
    minWidth: "40px",
    textAlign: "right",
  },
  guessRowEmpty: {
    color: "transparent",
  },
  showResultBtn: {
    position: "fixed",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "12px 24px",
    backgroundColor: "var(--correct)",
    color: "white",
    border: "none",
    borderRadius: "24px",
    fontSize: "0.875rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
  },
  debugBtn: {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    padding: "8px 12px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.75rem",
    fontWeight: 600,
    opacity: 0.8,
  },
  sourceAttribution: {
    fontSize: "0.75rem",
    color: "var(--muted)",
    textAlign: "center",
    marginTop: "-8px",
    minHeight: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  sourceLink: {
    color: "var(--primary)",
    textDecoration: "none",
  },
  sourceRevealBtn: {
    background: "var(--background)",
    border: "1px dashed var(--border-dark)",
    color: "var(--muted)",
    fontSize: "0.75rem",
    cursor: "pointer",
    padding: "6px 12px",
    borderRadius: "12px",
    transition: "all 0.2s",
  },
};
