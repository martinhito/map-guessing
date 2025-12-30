"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useGame } from "@/hooks/useGame";
import MapDisplay from "@/components/MapDisplay";
import GuessInput from "@/components/GuessInput";
import AttemptHistory from "@/components/AttemptHistory";
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

        <div style={styles.guessSlots}>
          {Array.from({ length: maxGuesses }).map((_, i) => {
            const attemptIndex = attempts.length - 1 - i;
            const attempt = attemptIndex >= 0 ? attempts[attemptIndex] : null;

            return (
              <div
                key={i}
                style={{
                  ...styles.guessSlot,
                  ...(attempt
                    ? { backgroundColor: getSlotColor(attempt.similarity, puzzle.similarityThreshold) }
                    : i === attempts.length && !gameOver
                    ? styles.guessSlotCurrent
                    : {}),
                }}
              />
            );
          })}
        </div>

        <div style={{ width: "100%" }}>
          <GuessInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            disabled={gameOver}
            loading={loading}
            placeholder="What does this map show?"
            remainingGuesses={remainingGuesses}
            maxGuesses={maxGuesses}
          />
        </div>

        <AttemptHistory
          attempts={attempts}
          threshold={puzzle.similarityThreshold}
          maxGuesses={maxGuesses}
        />

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
    cursor: "pointer",
  },
};
