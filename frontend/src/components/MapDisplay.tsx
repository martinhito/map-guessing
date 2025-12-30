"use client";

import { CSSProperties, useState } from "react";

interface Props {
  imageUrl: string;
  puzzleId: string;
}

export default function MapDisplay({ imageUrl, puzzleId }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [showModal, setShowModal] = useState(false);

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
    <>
      <div style={styles.container} onClick={() => setShowModal(true)}>
        <img
          src={imageUrl}
          alt={`Map puzzle ${puzzleId}`}
          crossOrigin="anonymous"
          style={styles.image}
        />
        <div style={styles.zoomHint}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </div>
      </div>

      {showModal && (
        <div style={styles.modal} onClick={() => setShowModal(false)}>
          <button style={styles.closeBtn} onClick={() => setShowModal(false)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <img
            src={imageUrl}
            alt={`Map puzzle ${puzzleId}`}
            crossOrigin="anonymous"
            style={styles.modalImage}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    width: "100%",
    borderRadius: "8px",
    overflow: "hidden",
    position: "relative",
    cursor: "zoom-in",
  },
  image: {
    width: "100%",
    display: "block",
    transition: "opacity 0.3s ease",
  },
  zoomHint: {
    position: "absolute",
    bottom: "8px",
    right: "8px",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    color: "white",
    padding: "6px",
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.7,
    transition: "opacity 0.2s",
  },
  modal: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    zIndex: 1000,
    cursor: "zoom-out",
  },
  modalImage: {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    borderRadius: "4px",
  },
  closeBtn: {
    position: "absolute",
    top: "16px",
    right: "16px",
    background: "rgba(255, 255, 255, 0.1)",
    border: "none",
    color: "white",
    padding: "8px",
    borderRadius: "50%",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
