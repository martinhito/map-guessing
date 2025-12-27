"use client";

import { CSSProperties } from "react";

interface Props {
  similarity: number;
  threshold: number;
}

const styles: Record<string, CSSProperties> = {
  container: {
    width: "100%",
    marginTop: "16px",
  },
  barTrack: {
    width: "100%",
    height: "24px",
    backgroundColor: "var(--border)",
    borderRadius: "12px",
    position: "relative",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: "12px",
    transition: "width 0.5s ease-out, background-color 0.3s",
  },
  thresholdMarker: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "3px",
    backgroundColor: "var(--foreground)",
    opacity: 0.5,
  },
  thresholdLabel: {
    position: "absolute",
    top: "-20px",
    transform: "translateX(-50%)",
    fontSize: "0.75rem",
    color: "var(--muted)",
  },
  labels: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "8px",
    fontSize: "0.875rem",
  },
  percentage: {
    fontWeight: 600,
  },
};

function getBarColor(similarity: number, threshold: number): string {
  const ratio = similarity / threshold;
  if (ratio >= 1) return "var(--success)";
  if (ratio >= 0.9) return "var(--warning)";
  if (ratio >= 0.7) return "#f97316"; // orange
  return "var(--primary)";
}

export default function SimilarityBar({ similarity, threshold }: Props) {
  const percentage = Math.round(similarity * 100);
  const thresholdPercent = Math.round(threshold * 100);
  const isNearThreshold = similarity >= threshold * 0.9;

  return (
    <div style={styles.container}>
      <div style={styles.barTrack}>
        <div
          style={{
            ...styles.barFill,
            width: `${Math.min(percentage, 100)}%`,
            backgroundColor: getBarColor(similarity, threshold),
          }}
        />
        <div
          style={{
            ...styles.thresholdMarker,
            left: `${thresholdPercent}%`,
          }}
        >
          <span style={styles.thresholdLabel}>{thresholdPercent}%</span>
        </div>
      </div>
      <div style={styles.labels}>
        <span>Similarity</span>
        <span
          style={{
            ...styles.percentage,
            color: isNearThreshold ? "var(--success)" : "inherit",
          }}
        >
          {percentage}%
        </span>
      </div>
    </div>
  );
}
