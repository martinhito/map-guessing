"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useGame } from "@/hooks/useGame";
import MapDisplay from "@/components/MapDisplay";
import GuessInput from "@/components/GuessInput";
import HintPanel from "@/components/HintPanel";
import ResultModal from "@/components/ResultModal";

export default function TestPuzzlePage() {
  const params = useParams();
  const puzzleId = params.puzzleId as string;

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
    loadPuzzle,
  } = useGame(puzzleId);

  const [inputValue, setInputValue] = useState("");
  const [showResult, setShowResult] = useState(false);

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

  const handleReset = async () => {
    if (!puzzle) return;
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    await fetch(`${API_BASE}/api/puzzle/${puzzle.id}/reset`, {
      method: "POST",
      credentials: "include",
    });
    window.location.reload();
  };

  if (loading && !puzzle) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <a href="/admin" style={styles.backLink}>← Back to Admin</a>
          <h1 style={styles.title}>Testing: {puzzleId}</h1>
        </div>
        <main style={styles.main}>
          <div style={styles.loading}>
            <div style={styles.spinner} />
          </div>
        </main>
      </div>
    );
  }

  if (error && !puzzle) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <a href="/admin" style={styles.backLink}>← Back to Admin</a>
          <h1 style={styles.title}>Testing: {puzzleId}</h1>
        </div>
        <main style={styles.main}>
          <div style={styles.errorBox}>{error}</div>
        </main>
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <a href="/admin" style={styles.backLink}>← Back to Admin</a>
          <h1 style={styles.title}>Testing: {puzzleId}</h1>
        </div>
        <main style={styles.main}>
          <div style={styles.errorBox}>Puzzle not found</div>
        </main>
      </div>
    );
  }

  const maxGuesses = puzzle.maxGuesses || 5;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <a href="/admin" style={styles.backLink}>← Back to Admin</a>
        <h1 style={styles.title}>Testing: {puzzleId}</h1>
        <button onClick={handleReset} style={styles.resetBtn}>
          Reset
        </button>
      </div>

      {/* Test info banner */}
      <div style={styles.testBanner}>
        <strong>Test Mode</strong> — Answer: {puzzle.sourceText ? `"${puzzle.sourceText}"` : "Not set"}
      </div>

      <main style={styles.main}>
        <MapDisplay imageUrl={puzzle.imageUrl} puzzleId={puzzle.id} />

        {puzzle.sourceText && (
          <div style={styles.sourceAttribution}>
            Source: {puzzle.sourceText}
            {gameOver && sourceUrl && (
              <> — <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={styles.sourceLink}>View data</a></>
            )}
          </div>
        )}

        {/* Wordle-style guess board */}
        <div style={styles.guessBoard}>
          {Array.from({ length: maxGuesses }).map((_, i) => {
            const attemptIndex = attempts.length - 1 - i;
            const attempt = attemptIndex >= 0 ? attempts[attemptIndex] : null;
            const isCurrentRow = i === attempts.length && !gameOver;

            if (attempt) {
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
              return (
                <div key={i} style={{ width: "100%" }}>
                  <GuessInput
                    value={inputValue}
                    onChange={setInputValue}
                    onSubmit={handleSubmit}
                    disabled={gameOver}
                    loading={loading}
                    placeholder="What does this map show?"
                  />
                </div>
              );
            }

            return (
              <div key={i} style={styles.guessRow}>
                <span style={styles.guessRowEmpty}>&nbsp;</span>
              </div>
            );
          })}
        </div>

        {puzzle.hintsAvailable > 0 && (
          <HintPanel
            hints={hints}
            hintsAvailable={puzzle.hintsAvailable}
            onRevealHint={revealHint}
            disabled={gameOver}
          />
        )}
      </main>

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

      {gameOver && !showResult && (
        <button
          onClick={() => setShowResult(true)}
          style={styles.showResultBtn}
        >
          View Results
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
    borderBottom: "1px solid var(--border)",
    backgroundColor: "var(--header-bg)",
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  backLink: {
    color: "var(--primary)",
    textDecoration: "none",
    fontSize: "0.875rem",
  },
  title: {
    fontSize: "1rem",
    fontWeight: 600,
    flex: 1,
    margin: 0,
  },
  resetBtn: {
    padding: "6px 12px",
    backgroundColor: "var(--error)",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  testBanner: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderBottom: "1px solid var(--primary)",
    padding: "8px 16px",
    fontSize: "0.8125rem",
    textAlign: "center",
    color: "var(--primary)",
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
  sourceAttribution: {
    fontSize: "0.75rem",
    color: "var(--muted)",
    textAlign: "center",
    marginTop: "-8px",
  },
  sourceLink: {
    color: "var(--primary)",
    textDecoration: "none",
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
    cursor: "pointer",
  },
};
