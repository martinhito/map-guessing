"use client";

import { CSSProperties, KeyboardEvent } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder?: string;
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    gap: "12px",
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
    transition: "border-color 0.2s",
  },
  button: {
    padding: "14px 24px",
    fontSize: "1rem",
    fontWeight: 600,
    backgroundColor: "var(--primary)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    transition: "background-color 0.2s",
  },
  buttonDisabled: {
    backgroundColor: "var(--muted)",
    cursor: "not-allowed",
  },
};

export default function GuessInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = "Enter your guess...",
}: Props) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !disabled && value.trim()) {
      onSubmit();
    }
  };

  return (
    <div style={styles.container}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          ...styles.input,
          ...(disabled ? { opacity: 0.6 } : {}),
        }}
      />
      <button
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        style={{
          ...styles.button,
          ...(disabled || !value.trim() ? styles.buttonDisabled : {}),
        }}
      >
        Guess
      </button>
    </div>
  );
}
