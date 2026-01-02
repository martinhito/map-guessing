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
            Figure out what the map is showing. You have a limited number of guesses to get it right.
          </p>
        </div>

        {/* Example */}
        <div style={styles.exampleSection}>
          <div style={styles.exampleImageContainer}>
            <img
              src="/example-map.png"
              alt="Example map showing forest coverage by US state"
              style={styles.exampleImage}
            />
          </div>
          <div style={styles.exampleAnswer}>
            <span style={styles.exampleLabel}>Answer:</span> Percent of Land Covered by Forest
          </div>
        </div>

        <div style={styles.section}>
          <p style={styles.text}>
            Type what you think the map represents and hit enter. The color shows how close your guess was to the answer.
          </p>
          <p style={styles.textNote}>
            Your answer doesn't need to match exactly — close-enough answers will be accepted!
          </p>
        </div>

        <div style={styles.divider} />

        <h3 style={styles.subtitle}>What the colors mean</h3>

        <div style={styles.exampleList}>
          <div style={styles.example}>
            <div style={{ ...styles.colorBlock, backgroundColor: "var(--correct)" }} />
            <div style={styles.exampleText}>
              <strong>Correct!</strong> — Nailed it
            </div>
          </div>
          <div style={styles.example}>
            <div style={{ ...styles.colorBlock, backgroundColor: "var(--close)" }} />
            <div style={styles.exampleText}>
              <strong>Very Close / Close</strong> — Almost there
            </div>
          </div>
          <div style={styles.example}>
            <div style={{ ...styles.colorBlock, backgroundColor: "var(--warm)" }} />
            <div style={styles.exampleText}>
              <strong>On Track / Getting There</strong> — Keep trying
            </div>
          </div>
          <div style={styles.example}>
            <div style={{ ...styles.colorBlock, backgroundColor: "var(--cold)" }} />
            <div style={styles.exampleText}>
              <strong>Way Off</strong> — Try something different
            </div>
          </div>
          <div style={styles.example}>
            <div style={{ ...styles.colorBlock, backgroundColor: "var(--hint)" }}>
              <span style={{ fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>💡</span>
            </div>
            <div style={styles.exampleText}>
              <strong>Hint</strong> — Spent a guess to get a clue
            </div>
          </div>
        </div>

        <div style={styles.divider} />

        <div style={styles.section}>
          <p style={styles.textSmall}>
            New puzzle every day at midnight EST.
          </p>
          <p style={styles.textSmall}>
            Stuck? You can spend a guess to reveal a hint — but use them wisely!
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
    margin: "0 0 8px 0",
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
  exampleSection: {
    marginBottom: "16px",
  },
  exampleImageContainer: {
    borderRadius: "8px",
    overflow: "hidden",
    marginBottom: "8px",
  },
  exampleImage: {
    width: "100%",
    display: "block",
  },
  exampleAnswer: {
    textAlign: "center",
    fontSize: "0.875rem",
    padding: "8px 12px",
    backgroundColor: "var(--background)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    color: "var(--foreground)",
  },
  exampleLabel: {
    fontWeight: 600,
    color: "var(--muted)",
  },
  textNote: {
    fontSize: "0.8125rem",
    lineHeight: 1.5,
    margin: "8px 0 0 0",
    color: "var(--muted)",
    fontStyle: "italic",
  },
};
