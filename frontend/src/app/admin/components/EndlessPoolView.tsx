"use client";

import { useState, useEffect, CSSProperties } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Puzzle {
  id: string;
  answer: string;
  imageUrl: string;
  createdAt?: string;
  inEndlessPool: boolean;
  scheduledDate?: string;
}

interface Props {
  password: string;
}

const styles: Record<string, CSSProperties> = {
  container: {
    padding: "24px",
    backgroundColor: "var(--card-bg)",
    borderRadius: "12px",
    border: "1px solid var(--border)",
  },
  title: {
    fontSize: "1.125rem",
    fontWeight: 600,
    marginBottom: "8px",
  },
  subtitle: {
    color: "var(--muted)",
    fontSize: "0.875rem",
    marginBottom: "16px",
  },
  puzzleList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  puzzleItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    backgroundColor: "var(--background)",
    borderRadius: "8px",
    transition: "background-color 0.2s",
  },
  puzzleItemActive: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    border: "1px solid var(--success)",
  },
  thumbnail: {
    width: "48px",
    height: "48px",
    borderRadius: "6px",
    objectFit: "cover" as const,
    flexShrink: 0,
  },
  puzzleInfo: {
    flex: 1,
    minWidth: 0,
  },
  puzzleId: {
    fontWeight: 500,
    fontSize: "0.875rem",
  },
  puzzleAnswer: {
    color: "var(--muted)",
    fontSize: "0.75rem",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  toggle: {
    position: "relative" as const,
    width: "44px",
    height: "24px",
    backgroundColor: "var(--border)",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "background-color 0.2s",
    flexShrink: 0,
  },
  toggleActive: {
    backgroundColor: "var(--success)",
  },
  toggleKnob: {
    position: "absolute" as const,
    top: "2px",
    left: "2px",
    width: "20px",
    height: "20px",
    backgroundColor: "white",
    borderRadius: "50%",
    transition: "transform 0.2s",
  },
  toggleKnobActive: {
    transform: "translateX(20px)",
  },
  loading: {
    textAlign: "center" as const,
    padding: "24px",
    color: "var(--muted)",
  },
  empty: {
    textAlign: "center" as const,
    padding: "24px",
    color: "var(--muted)",
    fontStyle: "italic",
  },
  poolCount: {
    fontSize: "0.875rem",
    color: "var(--muted)",
    marginBottom: "16px",
  },
};

export default function EndlessPoolView({ password }: Props) {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    loadPuzzles();
  }, []);

  const loadPuzzles = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/puzzles/all`, {
        headers: { "X-Admin-Password": password },
      });
      const data = await response.json();
      setPuzzles(data.puzzles || []);
    } catch (e) {
      console.error("Failed to load puzzles", e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (puzzleId: string, currentState: boolean) => {
    setToggling(puzzleId);

    const formData = new FormData();
    formData.append("inPool", (!currentState).toString());

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/puzzles/${puzzleId}/endless-pool`,
        {
          method: "POST",
          headers: { "X-Admin-Password": password },
          body: formData,
        }
      );

      if (response.ok) {
        setPuzzles((prev) =>
          prev.map((p) =>
            p.id === puzzleId ? { ...p, inEndlessPool: !currentState } : p
          )
        );
      }
    } catch (e) {
      console.error("Failed to toggle endless pool", e);
    } finally {
      setToggling(null);
    }
  };

  const poolCount = puzzles.filter((p) => p.inEndlessPool).length;

  if (loading) {
    return <div style={styles.loading}>Loading puzzles...</div>;
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Endless Mode Pool</h2>
      <p style={styles.subtitle}>
        Toggle puzzles to include them in the endless mode rotation. Players
        will get random puzzles from this pool.
      </p>

      <p style={styles.poolCount}>
        {poolCount} puzzle{poolCount !== 1 ? "s" : ""} in pool
      </p>

      {puzzles.length === 0 ? (
        <p style={styles.empty}>No puzzles available. Create one first!</p>
      ) : (
        <div style={styles.puzzleList}>
          {puzzles.map((puzzle) => (
            <div
              key={puzzle.id}
              style={{
                ...styles.puzzleItem,
                ...(puzzle.inEndlessPool ? styles.puzzleItemActive : {}),
              }}
            >
              <img
                src={puzzle.imageUrl}
                alt={puzzle.answer}
                style={styles.thumbnail}
              />
              <div style={styles.puzzleInfo}>
                <div style={styles.puzzleId}>{puzzle.id}</div>
                <div style={styles.puzzleAnswer}>{puzzle.answer}</div>
              </div>
              <button
                onClick={() => handleToggle(puzzle.id, puzzle.inEndlessPool)}
                disabled={toggling === puzzle.id}
                style={{
                  ...styles.toggle,
                  ...(puzzle.inEndlessPool ? styles.toggleActive : {}),
                  opacity: toggling === puzzle.id ? 0.5 : 1,
                }}
                aria-label={
                  puzzle.inEndlessPool
                    ? "Remove from endless pool"
                    : "Add to endless pool"
                }
              >
                <div
                  style={{
                    ...styles.toggleKnob,
                    ...(puzzle.inEndlessPool ? styles.toggleKnobActive : {}),
                  }}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
