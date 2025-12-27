"use client";

import { useState, CSSProperties } from "react";
import { useGame } from "@/hooks/useGame";
import MapDisplay from "@/components/MapDisplay";
import GuessInput from "@/components/GuessInput";
import SimilarityBar from "@/components/SimilarityBar";
import HintPanel from "@/components/HintPanel";
import AttemptHistory from "@/components/AttemptHistory";
import GameStatus from "@/components/GameStatus";

const styles: Record<string, CSSProperties> = {
  container: {
    maxWidth: "900px",
    margin: "0 auto",
    padding: "24px 16px",
    minHeight: "100vh",
  },
  header: {
    marginBottom: "24px",
  },
  eyebrow: {
    fontSize: "0.875rem",
    fontWeight: 600,
    color: "var(--primary)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "4px",
  },
  title: {
    fontSize: "1.75rem",
    fontWeight: 700,
    marginBottom: "8px",
  },
  subtitle: {
    color: "var(--muted)",
    marginBottom: "16px",
  },
  main: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
    color: "var(--muted)",
    fontSize: "1.125rem",
  },
  error: {
    padding: "24px",
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    border: "1px solid var(--error)",
    borderRadius: "8px",
    color: "var(--error)",
    textAlign: "center",
  },
  gameOverBox: {
    marginTop: "20px",
    padding: "20px",
    borderRadius: "8px",
    textAlign: "center",
  },
  successBox: {
    backgroundColor: "rgba(22, 163, 74, 0.1)",
    border: "1px solid var(--success)",
  },
  failureBox: {
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    border: "1px solid var(--error)",
  },
  successText: {
    color: "var(--success)",
    fontSize: "1.25rem",
    fontWeight: 600,
  },
  failureText: {
    color: "var(--error)",
    fontSize: "1rem",
  },
  answer: {
    marginTop: "8px",
    fontSize: "1.125rem",
    fontWeight: 600,
    color: "var(--foreground)",
  },
};

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

  const [lastSimilarity, setLastSimilarity] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = async () => {
    if (!inputValue.trim() || loading || gameOver) return;

    const result = await makeGuess(inputValue.trim());
    if (result) {
      setLastSimilarity(result.similarity);
      setInputValue("");
    }
  };

  if (loading && !puzzle) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading puzzle...</div>
      </div>
    );
  }

  if (error && !puzzle) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>No puzzle available for today</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>Daily Map Puzzle</p>
        <h1 style={styles.title}>Guess what this map represents</h1>
        <p style={styles.subtitle}>
          Study the map and describe what it shows. Get{" "}
          {Math.round(puzzle.similarityThreshold * 100)}% similarity to win!
        </p>
        <GameStatus
          puzzleId={puzzle.id}
          remainingGuesses={remainingGuesses}
          threshold={puzzle.similarityThreshold}
          solved={solved}
          gameOver={gameOver}
        />
      </header>

      <main style={styles.main}>
        <MapDisplay imageUrl={puzzle.imageUrl} puzzleId={puzzle.id} />

        <div>
          <GuessInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            disabled={loading || gameOver}
            placeholder="e.g., Population density by county"
          />

          {lastSimilarity !== null && (
            <SimilarityBar
              similarity={lastSimilarity}
              threshold={puzzle.similarityThreshold}
            />
          )}
        </div>

        {gameOver && (
          <div
            style={{
              ...styles.gameOverBox,
              ...(solved ? styles.successBox : styles.failureBox),
            }}
          >
            {solved ? (
              <p style={styles.successText}>Congratulations! You got it!</p>
            ) : (
              <p style={styles.failureText}>Better luck tomorrow!</p>
            )}
            {answer && <p style={styles.answer}>Answer: {answer}</p>}
          </div>
        )}

        {puzzle.hintsAvailable > 0 && (
          <HintPanel
            hints={hints}
            hintsAvailable={puzzle.hintsAvailable}
            onRevealHint={revealHint}
            disabled={gameOver}
          />
        )}

        <AttemptHistory attempts={attempts} />
      </main>
    </div>
  );
}
