"use client";

import { CSSProperties, useEffect, useState } from "react";

interface Props {
  onClose: () => void;
}

export default function HelpModal({ onClose }: Props) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
  }, []);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={{
          ...styles.modal,
          ...(animate ? styles.modalAnimated : {}),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button style={styles.closeBtn} onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h2 style={styles.title}>How to Play</h2>

        <div style={styles.section}>
          <p style={styles.text}>
            Guess what the map is showing in 6 tries.
          </p>
        </div>

        <div style={styles.section}>
          <p style={styles.text}>
            Each guess must describe what you think the map represents. After each guess, you'll see how close you were.
          </p>
        </div>

        <div style={styles.divider} />

        <h3 style={styles.subtitle}>Examples</h3>

        <div style={styles.exampleList}>
          <div style={styles.example}>
            <div style={{ ...styles.colorBlock, backgroundColor: "var(--correct)" }} />
            <div style={styles.exampleText}>
              <strong>100%</strong> — You got it! The answer is correct.
            </div>
          </div>
          <div style={styles.example}>
            <div style={{ ...styles.colorBlock, backgroundColor: "var(--close)" }} />
            <div style={styles.exampleText}>
              <strong>80-99%</strong> — Very close! You're almost there.
            </div>
          </div>
          <div style={styles.example}>
            <div style={{ ...styles.colorBlock, backgroundColor: "var(--warm)" }} />
            <div style={styles.exampleText}>
              <strong>50-79%</strong> — Warm. You're on the right track.
            </div>
          </div>
          <div style={styles.example}>
            <div style={{ ...styles.colorBlock, backgroundColor: "var(--cold)" }} />
            <div style={styles.exampleText}>
              <strong>Below 50%</strong> — Cold. Try a different approach.
            </div>
          </div>
        </div>

        <div style={styles.divider} />

        <div style={styles.section}>
          <p style={styles.textSmall}>
            A new map is available each day. Use hints if you get stuck!
          </p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    zIndex: 100,
  },
  modal: {
    backgroundColor: "var(--card-bg)",
    borderRadius: "16px",
    padding: "24px",
    maxWidth: "400px",
    width: "100%",
    position: "relative",
    opacity: 0,
    transform: "scale(0.9) translateY(20px)",
    transition: "all 0.3s ease-out",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  modalAnimated: {
    opacity: 1,
    transform: "scale(1) translateY(0)",
  },
  closeBtn: {
    position: "absolute",
    top: "12px",
    right: "12px",
    background: "none",
    border: "none",
    color: "var(--muted)",
    padding: "4px",
    borderRadius: "4px",
  },
  title: {
    fontSize: "1.25rem",
    fontWeight: 700,
    marginBottom: "16px",
    textAlign: "center",
  },
  subtitle: {
    fontSize: "0.875rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--muted)",
    marginBottom: "12px",
  },
  section: {
    marginBottom: "12px",
  },
  text: {
    fontSize: "0.9375rem",
    lineHeight: 1.5,
    margin: 0,
  },
  textSmall: {
    fontSize: "0.8125rem",
    lineHeight: 1.5,
    margin: 0,
    color: "var(--muted)",
    textAlign: "center",
  },
  divider: {
    height: "1px",
    backgroundColor: "var(--border)",
    margin: "16px 0",
  },
  exampleList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  example: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  colorBlock: {
    width: "32px",
    height: "32px",
    borderRadius: "4px",
    flexShrink: 0,
  },
  exampleText: {
    fontSize: "0.875rem",
    lineHeight: 1.4,
  },
};
