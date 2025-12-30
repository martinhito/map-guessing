"use client";

import { CSSProperties, useState } from "react";

interface Props {
  imageUrl: string;
  puzzleId: string;
}

export default function MapDisplay({ imageUrl, puzzleId }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!imageUrl) {
    return (
      <div style={styles.container}>
        <div style={styles.placeholder}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p style={styles.placeholderText}>No map available</p>
        </div>
      </div>
    );
  }

  if (!loaded && !error) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingOverlay}>
          <div style={styles.spinner} />
        </div>
        {/* Hidden image to trigger load */}
        <img
          src={imageUrl}
          alt=""
          crossOrigin="anonymous"
          style={{ display: "none" }}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.placeholder}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="9" x2="15" y2="15" />
            <line x1="15" y1="9" x2="9" y2="15" />
          </svg>
          <p style={styles.placeholderText}>Failed to load map</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <img
        src={imageUrl}
        alt={`Map puzzle ${puzzleId}`}
        crossOrigin="anonymous"
        style={styles.image}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    width: "100%",
    borderRadius: "8px",
    overflow: "hidden",
    position: "relative",
  },
  image: {
    width: "100%",
    display: "block",
    transition: "opacity 0.3s ease",
  },
  placeholder: {
    width: "100%",
    minHeight: "200px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    color: "var(--muted)",
    backgroundColor: "var(--card-bg)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
  },
  placeholderText: {
    fontSize: "0.875rem",
    margin: 0,
  },
  loadingOverlay: {
    width: "100%",
    minHeight: "200px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--card-bg)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
  },
  spinner: {
    width: "32px",
    height: "32px",
    border: "3px solid var(--border)",
    borderTopColor: "var(--correct)",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
};
