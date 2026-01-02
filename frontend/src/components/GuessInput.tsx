"use client";

import { CSSProperties, KeyboardEvent, useRef, useEffect } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  loading?: boolean;
  placeholder?: string;
  hintsAvailable?: number;
  hintsUsed?: number;
  onRevealHint?: () => void;
}

export default function GuessInput({
  value,
  onChange,
  onSubmit,
  disabled,
  loading = false,
  placeholder = "Enter your guess...",
  hintsAvailable = 0,
  hintsUsed = 0,
  onRevealHint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintsRemaining = hintsAvailable - hintsUsed;
  const canRevealHint = hintsRemaining > 0 && !disabled && onRevealHint;

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !disabled && value.trim()) {
      onSubmit();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.inputRow}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          style={{
            ...styles.input,
            ...(disabled ? styles.inputDisabled : {}),
          }}
        />
        <button
          onClick={onSubmit}
          disabled={disabled || loading || !value.trim()}
          style={{
            ...styles.button,
            ...(disabled || loading || !value.trim() ? styles.buttonDisabled : {}),
          }}
        >
          {loading ? (
            <div style={styles.spinner} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          )}
        </button>
      </div>

      {canRevealHint && (
        <div style={styles.hintRow}>
          <span style={styles.orText}>or</span>
          <button
            onClick={() => onRevealHint && onRevealHint()}
            disabled={disabled || loading}
            style={{
              ...styles.hintButton,
              ...(disabled || loading ? styles.hintButtonDisabled : {}),
            }}
          >
            {loading ? (
              <div style={styles.hintSpinner} />
            ) : (
              <span style={styles.hintIcon}>💡</span>
            )}
            {loading ? "Getting hint..." : "Spend a guess to get a hint"}
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    width: "100%",
  },
  inputRow: {
    display: "flex",
    gap: "8px",
    width: "100%",
  },
  input: {
    flex: 1,
    padding: "14px 16px",
    fontSize: "1rem",
    border: "2px solid var(--border)",
    borderRadius: "8px",
    backgroundColor: "var(--card-bg)",
    color: "var(--foreground)",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  inputDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  button: {
    width: "52px",
    height: "52px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--correct)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    transition: "background-color 0.2s, transform 0.1s",
    flexShrink: 0,
  },
  buttonDisabled: {
    backgroundColor: "var(--muted)",
    cursor: "not-allowed",
  },
  spinner: {
    width: "20px",
    height: "20px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "white",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  hintRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
  },
  orText: {
    fontSize: "0.8125rem",
    color: "var(--muted)",
    fontStyle: "italic",
  },
  hintButton: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    fontSize: "0.875rem",
    fontWeight: 500,
    backgroundColor: "transparent",
    color: "var(--hint)",
    border: "2px dashed var(--hint)",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  hintButtonDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  hintIcon: {
    fontSize: "1rem",
  },
  hintSpinner: {
    width: "16px",
    height: "16px",
    border: "2px solid var(--hint)",
    borderTopColor: "transparent",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};
