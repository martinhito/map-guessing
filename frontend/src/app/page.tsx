"use client";

import { useState } from "react";
import { useGame } from "@/hooks/useGame";
import MapDisplay from "@/components/MapDisplay";
import GuessInput from "@/components/GuessInput";
import AttemptHistory from "@/components/AttemptHistory";
import HintPanel from "@/components/HintPanel";
import ResultModal from "@/components/ResultModal";
import HelpModal from "@/components/HelpModal";

export default function GamePage() {
  const {
    puzzle,
    attempts,
    hints,
    solved,
    gameOver,
    loading,
    error,
    answer,
    remainingGuesses,
    makeGuess,
    revealHint,
  } = useGame();

  const [inputValue, setInputValue] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [shakeInput, setShakeInput] = useState(false);

  const handleSubmit = async () => {
    if (!inputValue.trim() || loading || gameOver) return;

    const result = await makeGuess(inputValue.trim());
    if (result) {
      setInputValue("");
      if (result.correct || remainingGuesses <= 1) {
        setTimeout(() => setShowResult(true), 500);
      }
    } else {
      // Shake on error
      setShakeInput(true);
      setTimeout(() => setShakeInput(false), 500);
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
              <line x1="12" y1="17" x2="12.01" y2="17" />
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

  const maxGuesses = puzzle.maxGuesses || 6;

  return (
    <div style={styles.page}>
      {headerContent}

      {/* Main game area */}
      <main style={styles.main}>
        {/* Map */}
        <MapDisplay imageUrl={puzzle.imageUrl} puzzleId={puzzle.id} />

        {/* Guess slots indicator */}
        <div style={styles.guessSlots}>
          {Array.from({ length: maxGuesses }).map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.guessSlot,
                ...(i < attempts.length
                  ? { backgroundColor: getSlotColor(attempts[i].similarity, puzzle.similarityThreshold) }
                  : i === attempts.length && !gameOver
                  ? styles.guessSlotCurrent
                  : {}),
              }}
            />
          ))}
        </div>

        {/* Input area */}
        <div style={{ width: "100%" }} className={shakeInput ? "animate-shake" : ""}>
          <GuessInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            disabled={loading || gameOver}
            placeholder="What does this map show?"
          />
        </div>

        {/* Previous guesses */}
        <AttemptHistory
          attempts={attempts}
          threshold={puzzle.similarityThreshold}
          maxGuesses={maxGuesses}
        />

        {/* Hints */}
        {puzzle.hintsAvailable > 0 && (
          <HintPanel
            hints={hints}
            hintsAvailable={puzzle.hintsAvailable}
            onRevealHint={revealHint}
            disabled={gameOver}
          />
        )}
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
          onClose={() => setShowResult(false)}
        />
      )}

      {/* Show result button if game is over but modal was closed */}
      {gameOver && !showResult && (
        <button
          onClick={() => setShowResult(true)}
          style={styles.showResultBtn}
        >
          View Results
        </button>
      )}

      {/* Help modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function getSlotColor(similarity: number, threshold: number): string {
  const ratio = similarity / threshold;
  if (ratio >= 1) return "var(--correct)";
  if (ratio >= 0.8) return "var(--close)";
  if (ratio >= 0.5) return "var(--warm)";
  return "var(--cold)";
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
  guessSlots: {
    display: "flex",
    gap: "6px",
    justifyContent: "center",
  },
  guessSlot: {
    width: "32px",
    height: "8px",
    borderRadius: "4px",
    backgroundColor: "var(--border)",
    transition: "background-color 0.3s ease",
  },
  guessSlotCurrent: {
    backgroundColor: "var(--border-dark)",
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
};
