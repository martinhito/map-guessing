"use client";

import { useState, useEffect, CSSProperties, FormEvent } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const styles: Record<string, CSSProperties> = {
  container: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "24px 16px",
    minHeight: "100vh",
  },
  header: {
    marginBottom: "32px",
  },
  title: {
    fontSize: "1.75rem",
    fontWeight: 700,
    marginBottom: "8px",
  },
  subtitle: {
    color: "var(--muted)",
  },
  loginBox: {
    maxWidth: "400px",
    margin: "100px auto",
    padding: "32px",
    backgroundColor: "var(--card-bg)",
    borderRadius: "12px",
    border: "1px solid var(--border)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: 500,
    marginBottom: "4px",
    display: "block",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    fontSize: "1rem",
    border: "2px solid var(--border)",
    borderRadius: "8px",
    backgroundColor: "var(--card-bg)",
    color: "var(--foreground)",
    outline: "none",
  },
  textarea: {
    width: "100%",
    padding: "12px 14px",
    fontSize: "1rem",
    border: "2px solid var(--border)",
    borderRadius: "8px",
    backgroundColor: "var(--card-bg)",
    color: "var(--foreground)",
    outline: "none",
    minHeight: "80px",
    resize: "vertical",
    fontFamily: "inherit",
  },
  button: {
    padding: "12px 24px",
    fontSize: "1rem",
    fontWeight: 600,
    backgroundColor: "var(--primary)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
  buttonDisabled: {
    backgroundColor: "var(--muted)",
    cursor: "not-allowed",
  },
  buttonSecondary: {
    backgroundColor: "transparent",
    color: "var(--primary)",
    border: "2px solid var(--primary)",
  },
  error: {
    color: "var(--error)",
    fontSize: "0.875rem",
    marginTop: "8px",
  },
  success: {
    color: "var(--success)",
    fontSize: "0.875rem",
    marginTop: "8px",
  },
  section: {
    marginBottom: "32px",
    padding: "24px",
    backgroundColor: "var(--card-bg)",
    borderRadius: "12px",
    border: "1px solid var(--border)",
  },
  sectionTitle: {
    fontSize: "1.125rem",
    fontWeight: 600,
    marginBottom: "16px",
  },
  previewImage: {
    maxWidth: "100%",
    maxHeight: "300px",
    borderRadius: "8px",
    marginTop: "12px",
  },
  fileInput: {
    padding: "8px 0",
  },
  stepIndicator: {
    display: "flex",
    gap: "8px",
    marginBottom: "24px",
  },
  step: {
    padding: "8px 16px",
    borderRadius: "20px",
    fontSize: "0.875rem",
    fontWeight: 500,
    backgroundColor: "var(--border)",
    color: "var(--muted)",
  },
  stepActive: {
    backgroundColor: "var(--primary)",
    color: "white",
  },
  stepComplete: {
    backgroundColor: "var(--success)",
    color: "white",
  },
  puzzleList: {
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "16px",
  },
  puzzleItem: {
    padding: "12px 16px",
    backgroundColor: "var(--background)",
    borderRadius: "8px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
};

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Upload state
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [puzzleDate, setPuzzleDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [answer, setAnswer] = useState("");
  const [hints, setHints] = useState("");
  const [maxGuesses, setMaxGuesses] = useState(6);
  const [threshold, setThreshold] = useState(0.95);

  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Existing puzzles
  const [puzzles, setPuzzles] = useState<
    { id: string; lastModified: string }[]
  >([]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");

    const response = await fetch(`${API_BASE}/api/admin/verify`, {
      method: "POST",
      headers: {
        "X-Admin-Password": password,
      },
    });

    const data = await response.json();
    if (data.valid) {
      setIsAuthenticated(true);
      localStorage.setItem("adminPassword", password);
      loadPuzzles(password);
    } else {
      setAuthError("Invalid password");
    }
  };

  const loadPuzzles = async (pwd: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/puzzles`, {
        headers: {
          "X-Admin-Password": pwd,
        },
      });
      const data = await response.json();
      setPuzzles(data.puzzles || []);
    } catch (e) {
      console.error("Failed to load puzzles", e);
    }
  };

  // Check for stored password on mount
  useEffect(() => {
    const stored = localStorage.getItem("adminPassword");
    if (stored) {
      setPassword(stored);
      fetch(`${API_BASE}/api/admin/verify`, {
        method: "POST",
        headers: { "X-Admin-Password": stored },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.valid) {
            setIsAuthenticated(true);
            loadPuzzles(stored);
          }
        });
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setUploadedImageUrl(null);
    }
  };

  const handleUploadImage = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("date", puzzleDate);

    try {
      const response = await fetch(`${API_BASE}/api/admin/upload-image`, {
        method: "POST",
        headers: {
          "X-Admin-Password": password,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Upload failed");
      }

      const data = await response.json();
      setUploadedImageUrl(data.imageUrl);
      setStep(2);
      setMessage({ type: "success", text: "Image uploaded successfully!" });
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Upload failed",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCreatePuzzle = async (e: FormEvent) => {
    e.preventDefault();
    if (!uploadedImageUrl || !answer) return;

    setCreating(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("imageUrl", uploadedImageUrl);
    formData.append("answer", answer);
    formData.append("hints", hints);
    formData.append("date", puzzleDate);
    formData.append("maxGuesses", maxGuesses.toString());
    formData.append("similarityThreshold", threshold.toString());

    try {
      const response = await fetch(`${API_BASE}/api/admin/create-puzzle`, {
        method: "POST",
        headers: {
          "X-Admin-Password": password,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create puzzle");
      }

      const data = await response.json();
      setMessage({
        type: "success",
        text: `Puzzle created for ${data.puzzleId}!`,
      });

      // Reset form
      setStep(1);
      setSelectedFile(null);
      setPreviewUrl(null);
      setUploadedImageUrl(null);
      setAnswer("");
      setHints("");

      // Reload puzzles
      loadPuzzles(password);
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Failed to create puzzle",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword("");
    localStorage.removeItem("adminPassword");
  };

  if (!isAuthenticated) {
    return (
      <div style={styles.container}>
        <div style={styles.loginBox}>
          <h1 style={{ ...styles.title, textAlign: "center" as const }}>
            Admin Login
          </h1>
          <form onSubmit={handleLogin} style={styles.form}>
            <div>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                placeholder="Enter admin password"
              />
            </div>
            <button type="submit" style={styles.button}>
              Login
            </button>
            {authError && <p style={styles.error}>{authError}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1 style={styles.title}>Puzzle Admin</h1>
            <p style={styles.subtitle}>Upload and manage daily puzzles</p>
          </div>
          <button
            onClick={handleLogout}
            style={{ ...styles.button, ...styles.buttonSecondary }}
          >
            Logout
          </button>
        </div>
      </header>

      <div style={styles.stepIndicator}>
        <span
          style={{
            ...styles.step,
            ...(step === 1 ? styles.stepActive : {}),
            ...(uploadedImageUrl ? styles.stepComplete : {}),
          }}
        >
          1. Upload Image
        </span>
        <span
          style={{
            ...styles.step,
            ...(step === 2 ? styles.stepActive : {}),
          }}
        >
          2. Set Answer & Hints
        </span>
      </div>

      {message && (
        <p style={message.type === "success" ? styles.success : styles.error}>
          {message.text}
        </p>
      )}

      {step === 1 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Upload Map Image</h2>
          <div style={styles.form}>
            <div>
              <label style={styles.label}>Puzzle Date</label>
              <input
                type="date"
                value={puzzleDate}
                onChange={(e) => setPuzzleDate(e.target.value)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Map Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={styles.fileInput}
              />
            </div>
            {previewUrl && (
              <div>
                <p style={styles.label}>Preview:</p>
                <img
                  src={previewUrl}
                  alt="Preview"
                  style={styles.previewImage}
                />
              </div>
            )}
            <button
              onClick={handleUploadImage}
              disabled={!selectedFile || uploading}
              style={{
                ...styles.button,
                ...(!selectedFile || uploading ? styles.buttonDisabled : {}),
              }}
            >
              {uploading ? "Uploading..." : "Upload Image"}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Set Answer & Hints</h2>
          {uploadedImageUrl && (
            <div style={{ marginBottom: "16px" }}>
              <p style={styles.label}>Uploaded Image:</p>
              <img
                src={uploadedImageUrl}
                alt="Uploaded"
                style={styles.previewImage}
              />
            </div>
          )}
          <form onSubmit={handleCreatePuzzle} style={styles.form}>
            <div>
              <label style={styles.label}>Answer *</label>
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                style={styles.input}
                placeholder="e.g., Median household income by US county"
                required
              />
              <p style={{ ...styles.subtitle, fontSize: "0.75rem", marginTop: "4px" }}>
                This is what users need to guess. The embedding will be
                calculated automatically.
              </p>
            </div>
            <div>
              <label style={styles.label}>Hints (comma-separated)</label>
              <textarea
                value={hints}
                onChange={(e) => setHints(e.target.value)}
                style={styles.textarea}
                placeholder="This map shows economic data, The data is measured in dollars, Look at the regional patterns"
              />
            </div>
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Max Guesses</label>
                <input
                  type="number"
                  value={maxGuesses}
                  onChange={(e) => setMaxGuesses(parseInt(e.target.value))}
                  style={styles.input}
                  min={1}
                  max={20}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Similarity Threshold</label>
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  style={styles.input}
                  min={0.5}
                  max={1}
                  step={0.01}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{ ...styles.button, ...styles.buttonSecondary }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!answer || creating}
                style={{
                  ...styles.button,
                  flex: 1,
                  ...(!answer || creating ? styles.buttonDisabled : {}),
                }}
              >
                {creating ? "Creating..." : "Create Puzzle"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Existing Puzzles</h2>
        {puzzles.length === 0 ? (
          <p style={styles.subtitle}>No puzzles uploaded yet</p>
        ) : (
          <ul style={styles.puzzleList}>
            {puzzles.map((puzzle) => (
              <li key={puzzle.id} style={styles.puzzleItem}>
                <span style={{ fontWeight: 500 }}>{puzzle.id}</span>
                <span style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
                  {new Date(puzzle.lastModified).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
