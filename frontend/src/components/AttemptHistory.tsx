"use client";

import { CSSProperties, useEffect, useState } from "react";
import { Attempt } from "@/lib/types";

interface Props {
  attempts: Attempt[];
  threshold: number;
  maxGuesses: number;
}

export default function AttemptHistory({ attempts, threshold, maxGuesses }: Props) {
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (attempts.length > 0) {
      setAnimatingIndex(attempts.length - 1);
      const timer = setTimeout(() => setAnimatingIndex(null), 500);
      return () => clearTimeout(timer);
    }
  }, [attempts.length]);

  if (attempts.length === 0) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.list}>
        {attempts.map((attempt, index) => {
          const ratio = attempt.similarity / threshold;
          const { bg, border, color, label } = getTemperatureStyle(ratio);
          const isAnimating = animatingIndex === index;

          // Scale percentage so threshold = 100%
          const scaledPercent = Math.min(Math.round((attempt.similarity / threshold) * 100), 100);

          return (
            <div
              key={index}
              style={{
                ...styles.item,
                backgroundColor: bg,
                borderColor: border,
                ...(isAnimating ? { animation: "fadeIn 0.3s ease-out" } : {}),
              }}
              className={isAnimating ? "animate-fade-in" : ""}
            >
              <div style={styles.itemContent}>
                <span style={styles.guessNumber}>#{index + 1}</span>
                <span style={styles.guessText}>{attempt.guess}</span>
              </div>
              <div style={styles.itemRight}>
                <span
                  style={{
                    ...styles.temperatureLabel,
                    color: color,
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    ...styles.percentage,
                    backgroundColor: color,
                  }}
                >
                  {scaledPercent}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getTemperatureStyle(ratio: number): {
  bg: string;
  border: string;
  color: string;
  label: string;
} {
  if (ratio >= 1) {
    return {
      bg: "var(--correct-bg)",
      border: "var(--correct)",
      color: "var(--correct)",
      label: "CORRECT!",
    };
  }
  if (ratio >= 0.85) {
    return {
      bg: "var(--close-bg)",
      border: "var(--close)",
      color: "var(--close)",
      label: "Very Close",
    };
  }
  if (ratio >= 0.70) {
    return {
      bg: "var(--close-bg)",
      border: "var(--close)",
      color: "var(--close)",
      label: "Close",
    };
  }
  if (ratio >= 0.55) {
    return {
      bg: "var(--warm-bg)",
      border: "var(--warm)",
      color: "var(--warm)",
      label: "On Track",
    };
  }
  if (ratio >= 0.40) {
    return {
      bg: "var(--warm-bg)",
      border: "var(--warm)",
      color: "var(--warm)",
      label: "Getting There",
    };
  }
  return {
    bg: "var(--cold-bg)",
    border: "var(--cold)",
    color: "var(--cold)",
    label: "Way Off",
  };
}

const styles: Record<string, CSSProperties> = {
  container: {
    width: "100%",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    borderRadius: "8px",
    border: "2px solid",
    transition: "all 0.2s ease",
  },
  itemContent: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flex: 1,
    minWidth: 0,
  },
  guessNumber: {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "var(--muted)",
    flexShrink: 0,
  },
  guessText: {
    fontSize: "0.9375rem",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  itemRight: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
  },
  temperatureLabel: {
    fontSize: "0.6875rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  percentage: {
    fontSize: "0.8125rem",
    fontWeight: 700,
    color: "white",
    padding: "4px 10px",
    borderRadius: "4px",
    minWidth: "52px",
    textAlign: "center",
  },
};
