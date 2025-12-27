"use client";

import { CSSProperties } from "react";

interface Props {
  imageUrl: string;
  puzzleId: string;
}

const styles: Record<string, CSSProperties> = {
  container: {
    width: "100%",
    aspectRatio: "16/10",
    backgroundColor: "var(--card-bg)",
    borderRadius: "12px",
    overflow: "hidden",
    border: "1px solid var(--border)",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--muted)",
    fontSize: "1rem",
  },
};

export default function MapDisplay({ imageUrl, puzzleId }: Props) {
  if (!imageUrl) {
    return (
      <div style={styles.container}>
        <div style={styles.placeholder}>No map available</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <img
        src={imageUrl}
        alt={`Map puzzle ${puzzleId}`}
        style={styles.image}
      />
    </div>
  );
}
