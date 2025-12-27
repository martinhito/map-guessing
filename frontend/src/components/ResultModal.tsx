"use client";

import { CSSProperties, useEffect, useState, useRef } from "react";
import { Attempt } from "@/lib/types";

interface Props {
  solved: boolean;
  answer: string;
  attempts: Attempt[];
  maxGuesses: number;
  threshold: number;
  puzzleId: string;
  imageUrl: string;
  onClose: () => void;
}

export default function ResultModal({
  solved,
  answer,
  attempts,
  maxGuesses,
  threshold,
  puzzleId,
  imageUrl,
  onClose,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setAnimate(true);
  }, []);

  // Reverse attempts so oldest is first (left to right)
  const orderedAttempts = [...attempts].reverse();

  const getColor = (similarity: number) => {
    const ratio = similarity / threshold;
    if (ratio >= 1) return { css: "var(--correct)", hex: "#22c55e" };
    if (ratio >= 0.8) return { css: "var(--close)", hex: "#eab308" };
    if (ratio >= 0.5) return { css: "var(--warm)", hex: "#f97316" };
    return { css: "var(--cold)", hex: "#3b3b3b" };
  };

  const generateShareText = (includeUrl = true) => {
    const result = solved ? `${attempts.length}/${maxGuesses}` : `X/${maxGuesses}`;

    const grid = orderedAttempts.map((attempt) => {
      const ratio = attempt.similarity / threshold;
      if (ratio >= 1) return "🟩";
      if (ratio >= 0.8) return "🟨";
      if (ratio >= 0.5) return "🟧";
      return "⬛";
    }).join("");

    const base = `Can You Guess the Map?

Puzzle ${puzzleId}
${grid} ${result}`;

    return includeUrl ? `${base}

https://canyouguessthemap.com` : base;
  };

  const generateShareImage = async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Canvas dimensions
    const width = 400;
    const height = 520;
    const padding = 20;
    const mapSize = width - padding * 2;
    const blockSize = 40;
    const blockGap = 6;

    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    // Helper to draw overlay (text, blocks, result)
    const drawOverlay = () => {
      // Draw title
      const titleY = padding + mapSize + 32;
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Can You Guess the Map?", width / 2, titleY);

      // Draw guess blocks
      const totalBlocksWidth = maxGuesses * blockSize + (maxGuesses - 1) * blockGap;
      const blocksStartX = (width - totalBlocksWidth) / 2;
      const blocksY = titleY + 20;

      for (let i = 0; i < maxGuesses; i++) {
        const x = blocksStartX + i * (blockSize + blockGap);
        const attempt = orderedAttempts[i];

        if (attempt) {
          ctx.fillStyle = getColor(attempt.similarity).hex;
        } else {
          ctx.fillStyle = "#2a2a3e";
          ctx.strokeStyle = "#444";
          ctx.lineWidth = 2;
        }

        ctx.beginPath();
        ctx.roundRect(x, blocksY, blockSize, blockSize, 6);
        ctx.fill();

        if (!attempt) {
          ctx.stroke();
        }
      }

      // Draw result
      const resultText = solved
        ? `${attempts.length}/${maxGuesses}`
        : `X/${maxGuesses}`;
      const resultY = blocksY + blockSize + 28;
      ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = solved ? "#22c55e" : "#ef4444";
      ctx.fillText(resultText, width / 2, resultY);
    };

    // Load and draw the map image
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        // Draw map with rounded corners
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(padding, padding, mapSize, mapSize, 12);
        ctx.clip();

        const scale = Math.max(mapSize / img.width, mapSize / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const offsetX = padding + (mapSize - scaledWidth) / 2;
        const offsetY = padding + (mapSize - scaledHeight) / 2;

        ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
        ctx.restore();

        drawOverlay();

        canvas.toBlob((blob) => resolve(blob), "image/png");
      };

      img.onerror = () => {
        // Draw placeholder
        ctx.fillStyle = "#2a2a3e";
        ctx.beginPath();
        ctx.roundRect(padding, padding, mapSize, mapSize, 12);
        ctx.fill();

        ctx.fillStyle = "#666";
        ctx.font = "16px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Map Puzzle", width / 2, padding + mapSize / 2);

        drawOverlay();

        canvas.toBlob((blob) => resolve(blob), "image/png");
      };

      img.src = imageUrl;
    });
  };

  const handleShare = async () => {
    setGenerating(true);

    try {
      const blob = await generateShareImage();

      // Try native share with image (mobile/iOS)
      if (blob && navigator.share && navigator.canShare) {
        const file = new File([blob], `map-guess-${puzzleId}.png`, { type: "image/png" });

        // Share URL with results text (link preview will show map from OG tags)
        const shareData: ShareData = {
          text: generateShareText(false),
          url: "https://canyouguessthemap.com",
        };

        if (navigator.canShare(shareData)) {
          try {
            await navigator.share(shareData);
            setGenerating(false);
            return;
          } catch (e) {
            // User cancelled or share failed - fall through to text-only
            if ((e as Error).name === "AbortError") {
              setGenerating(false);
              return;
            }
          }
        }

        // Try text-only share
        try {
          await navigator.share({ text: generateShareText(true) });
          setGenerating(false);
          return;
        } catch {
          // Fall through to clipboard
        }
      }

      // Desktop/fallback: copy image to clipboard if possible
      if (blob && navigator.clipboard && typeof ClipboardItem !== "undefined") {
        try {
          const clipboardItem = new ClipboardItem({
            "image/png": blob,
          });
          await navigator.clipboard.write([clipboardItem]);
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
          setGenerating(false);
          return;
        } catch {
          // Fall through to text copy
        }
      }

      // Fallback: just copy text
      const fullText = generateShareText(true);
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Ultimate fallback
      try {
        await navigator.clipboard.writeText(generateShareText(true));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        console.error("Share failed", error);
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={{
          ...styles.modal,
          ...(animate ? styles.modalAnimated : {}),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden canvas for image generation */}
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Close button */}
        <button style={styles.closeBtn} onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Result header */}
        <div style={styles.resultHeader}>
          {solved ? (
            <>
              <div style={styles.successIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--correct)" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={styles.title}>Well done!</h2>
              <p style={styles.subtitle}>
                You got it in {attempts.length} {attempts.length === 1 ? "guess" : "guesses"}
              </p>
            </>
          ) : (
            <>
              <div style={styles.failIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <h2 style={styles.title}>Better luck next time</h2>
              <p style={styles.subtitle}>The answer was:</p>
            </>
          )}
        </div>

        {/* Answer reveal - only show if failed */}
        {!solved && (
          <div style={styles.answerBox}>
            <p style={styles.answer}>{answer}</p>
          </div>
        )}

        {/* Stats grid */}
        <div style={styles.statsGrid}>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{attempts.length}</span>
            <span style={styles.statLabel}>Guesses</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>
              {Math.min(Math.round((Math.max(...attempts.map((a) => a.similarity)) / threshold) * 100), 100)}%
            </span>
            <span style={styles.statLabel}>Best</span>
          </div>
        </div>

        {/* Guess visualization - oldest first (left to right) */}
        <div style={styles.guessViz}>
          {orderedAttempts.map((attempt, i) => {
            const isWinningGuess = attempt.similarity / threshold >= 1;
            return (
              <div
                key={i}
                style={{
                  ...styles.guessBlock,
                  backgroundColor: getColor(attempt.similarity).css,
                }}
                title={`${Math.round(attempt.similarity * 100)}%`}
              >
                {isWinningGuess && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            );
          })}
          {/* Empty slots */}
          {Array.from({ length: maxGuesses - attempts.length }).map((_, i) => (
            <div key={`empty-${i}`} style={styles.guessBlockEmpty} />
          ))}
        </div>

        {/* Share button */}
        <button
          style={{
            ...styles.shareBtn,
            ...(generating ? styles.shareBtnDisabled : {}),
          }}
          onClick={handleShare}
          disabled={generating}
        >
          {generating ? (
            <>
              <div style={styles.spinner} />
              Generating...
            </>
          ) : copied ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Image Copied!
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Share
            </>
          )}
        </button>
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
    maxWidth: "360px",
    width: "100%",
    position: "relative",
    opacity: 0,
    transform: "scale(0.9) translateY(20px)",
    transition: "all 0.3s ease-out",
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
    cursor: "pointer",
  },
  resultHeader: {
    textAlign: "center",
    marginBottom: "20px",
  },
  successIcon: {
    marginBottom: "8px",
  },
  failIcon: {
    marginBottom: "8px",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    margin: "0 0 4px 0",
  },
  subtitle: {
    color: "var(--muted)",
    fontSize: "0.9375rem",
    margin: 0,
  },
  answerBox: {
    backgroundColor: "var(--background)",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "20px",
    textAlign: "center",
  },
  answer: {
    fontSize: "1.125rem",
    fontWeight: 600,
    margin: 0,
    lineHeight: 1.4,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
    marginBottom: "20px",
  },
  statItem: {
    textAlign: "center",
  },
  statValue: {
    display: "block",
    fontSize: "1.5rem",
    fontWeight: 700,
  },
  statLabel: {
    fontSize: "0.75rem",
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  guessViz: {
    display: "flex",
    gap: "4px",
    justifyContent: "center",
    marginBottom: "24px",
  },
  guessBlock: {
    width: "32px",
    height: "32px",
    borderRadius: "4px",
    transition: "transform 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  guessBlockEmpty: {
    width: "32px",
    height: "32px",
    borderRadius: "4px",
    border: "2px solid var(--border)",
    backgroundColor: "transparent",
  },
  shareBtn: {
    width: "100%",
    padding: "14px",
    backgroundColor: "var(--correct)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    cursor: "pointer",
  },
  shareBtnDisabled: {
    opacity: 0.7,
    cursor: "wait",
  },
  spinner: {
    width: "18px",
    height: "18px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "white",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};
