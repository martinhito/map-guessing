"use client";

import { useState, useEffect, CSSProperties } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ScheduledPuzzle {
  id: string;
  answer: string;
  imageUrl: string;
}

interface Puzzle {
  id: string;
  answer: string;
  imageUrl: string;
  inEndlessPool: boolean;
  scheduledDate?: string;
}

interface PuzzleDetails {
  id: string;
  imageUrl: string;
  answer: string;
  maxGuesses: number;
  similarityThreshold: number;
  similarityMode: "embedding" | "llm";
  hints: string[];
  sourceText: string | null;
  sourceUrl: string | null;
  inEndlessPool: boolean;
  scheduledDate: string | null;
  answerVariants: string[];
}

interface Props {
  password: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const styles: Record<string, CSSProperties> = {
  container: {
    padding: "24px",
    backgroundColor: "var(--card-bg)",
    borderRadius: "12px",
    border: "1px solid var(--border)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  title: {
    fontSize: "1.125rem",
    fontWeight: 600,
  },
  navButton: {
    padding: "8px 16px",
    backgroundColor: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    cursor: "pointer",
    color: "var(--foreground)",
  },
  monthNav: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  monthLabel: {
    fontSize: "1rem",
    fontWeight: 500,
    minWidth: "160px",
    textAlign: "center" as const,
  },
  weekdayRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "4px",
    marginBottom: "4px",
  },
  weekday: {
    textAlign: "center" as const,
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "var(--muted)",
    padding: "8px 0",
  },
  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "4px",
  },
  dayCell: {
    aspectRatio: "1",
    minHeight: "80px",
    padding: "6px",
    backgroundColor: "var(--background)",
    borderRadius: "8px",
    cursor: "pointer",
    border: "2px solid transparent",
    transition: "border-color 0.2s",
    display: "flex",
    flexDirection: "column" as const,
  },
  dayCellEmpty: {
    backgroundColor: "transparent",
    cursor: "default",
  },
  dayCellToday: {
    border: "2px solid var(--primary)",
  },
  dayCellScheduled: {
    border: "2px solid var(--success)",
  },
  dayNumber: {
    fontSize: "0.75rem",
    fontWeight: 500,
    marginBottom: "4px",
  },
  dayThumbnail: {
    flex: 1,
    width: "100%",
    borderRadius: "4px",
    objectFit: "cover" as const,
  },
  modal: {
    position: "fixed" as const,
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "var(--card-bg)",
    padding: "24px",
    borderRadius: "12px",
    maxWidth: "500px",
    width: "90%",
    maxHeight: "80vh",
    overflow: "auto" as const,
  },
  modalTitle: {
    fontSize: "1.125rem",
    fontWeight: 600,
    marginBottom: "16px",
  },
  puzzleOption: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    backgroundColor: "var(--background)",
    borderRadius: "8px",
    marginBottom: "8px",
    cursor: "pointer",
    border: "2px solid transparent",
    transition: "border-color 0.2s",
  },
  puzzleOptionSelected: {
    border: "2px solid var(--primary)",
  },
  puzzleOptionThumb: {
    width: "48px",
    height: "48px",
    borderRadius: "6px",
    objectFit: "cover" as const,
  },
  puzzleOptionInfo: {
    flex: 1,
  },
  puzzleOptionId: {
    fontWeight: 500,
    fontSize: "0.875rem",
  },
  puzzleOptionAnswer: {
    color: "var(--muted)",
    fontSize: "0.75rem",
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    marginTop: "16px",
  },
  button: {
    padding: "10px 20px",
    fontSize: "0.875rem",
    fontWeight: 600,
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  buttonPrimary: {
    backgroundColor: "var(--primary)",
    color: "white",
    flex: 1,
  },
  buttonSecondary: {
    backgroundColor: "transparent",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
  },
  buttonDanger: {
    backgroundColor: "var(--error)",
    color: "white",
  },
  loading: {
    textAlign: "center" as const,
    padding: "24px",
    color: "var(--muted)",
  },
  label: {
    fontSize: "0.875rem",
    fontWeight: 500,
    marginBottom: "4px",
    display: "block",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "0.9375rem",
    border: "2px solid var(--border)",
    borderRadius: "6px",
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
    outline: "none",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    fontSize: "0.9375rem",
    border: "2px solid var(--border)",
    borderRadius: "6px",
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
    outline: "none",
    resize: "vertical" as const,
    fontFamily: "inherit",
  },
  synonymList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
    marginTop: "8px",
    maxHeight: "150px",
    overflowY: "auto" as const,
  },
  synonymItem: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  addSynonymRow: {
    display: "flex",
    gap: "8px",
    marginTop: "8px",
  },
  buttonDangerSmall: {
    backgroundColor: "var(--error)",
    color: "white",
    border: "none",
    width: "28px",
    height: "28px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "1.25rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  modeToggle: {
    display: "flex",
    gap: "0",
    borderRadius: "6px",
    overflow: "hidden",
    border: "2px solid var(--border)",
  },
  modeToggleBtn: {
    flex: 1,
    padding: "8px 12px",
    fontSize: "0.8125rem",
    fontWeight: 500,
    border: "none",
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  modeToggleBtnActive: {
    backgroundColor: "var(--primary)",
    color: "white",
  },
  buttonTest: {
    backgroundColor: "#8b5cf6",
    color: "white",
  },
};

export default function CalendarView({ password }: Props) {
  // Use function initializers to ensure client-side date is used
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const today = new Date();
  const [schedule, setSchedule] = useState<Record<string, ScheduledPuzzle>>({});
  const [loading, setLoading] = useState(true);

  // Assignment modal state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [allPuzzles, setAllPuzzles] = useState<Puzzle[]>([]);
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit modal state
  const [editingPuzzle, setEditingPuzzle] = useState<PuzzleDetails | null>(null);
  const [editForm, setEditForm] = useState({
    answer: "",
    hints: "",
    synonyms: "",
    maxGuesses: 5,
    similarityThreshold: 0.85,
    similarityMode: "embedding" as "embedding" | "llm",
    sourceText: "",
    sourceUrl: "",
    inEndlessPool: false,
  });
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMessage, setEditMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadCalendar();
  }, [year, month]);

  const loadCalendar = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/calendar/${year}/${month}`,
        { headers: { "X-Admin-Password": password } }
      );
      const data = await response.json();
      setSchedule(data.schedule || {});
    } catch (e) {
      console.error("Failed to load calendar", e);
    } finally {
      setLoading(false);
    }
  };

  const loadAllPuzzles = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/puzzles/all`, {
        headers: { "X-Admin-Password": password },
      });
      const data = await response.json();
      setAllPuzzles(data.puzzles || []);
    } catch (e) {
      console.error("Failed to load puzzles", e);
    }
  };

  const handleDayClick = async (date: string) => {
    const puzzle = schedule[date];
    if (puzzle) {
      // If there's a puzzle, open edit modal
      await loadPuzzleDetails(puzzle.id);
    } else {
      // If no puzzle, open assignment modal
      setSelectedDate(date);
      setSelectedPuzzleId(null);
      await loadAllPuzzles();
    }
  };

  const loadPuzzleDetails = async (puzzleId: string) => {
    setLoadingEdit(true);
    setEditMessage(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/puzzles/${puzzleId}/details`, {
        headers: { "X-Admin-Password": password },
      });
      if (!response.ok) throw new Error("Failed to load puzzle");
      const data: PuzzleDetails = await response.json();
      setEditingPuzzle(data);
      setEditForm({
        answer: data.answer,
        hints: JSON.stringify(data.hints),
        synonyms: JSON.stringify(data.answerVariants.filter(v => v.toLowerCase() !== data.answer.toLowerCase())),
        maxGuesses: data.maxGuesses,
        similarityThreshold: data.similarityThreshold,
        similarityMode: data.similarityMode || "embedding",
        sourceText: data.sourceText || "",
        sourceUrl: data.sourceUrl || "",
        inEndlessPool: data.inEndlessPool,
      });
    } catch (e) {
      console.error("Failed to load puzzle details", e);
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPuzzle) return;
    setSavingEdit(true);
    setEditMessage(null);

    const formData = new FormData();
    formData.append("answer", editForm.answer);
    formData.append("hints", editForm.hints);
    formData.append("synonyms", editForm.synonyms || "[]");
    formData.append("maxGuesses", editForm.maxGuesses.toString());
    formData.append("similarityThreshold", editForm.similarityThreshold.toString());
    formData.append("similarityMode", editForm.similarityMode);
    formData.append("sourceText", editForm.sourceText);
    formData.append("sourceUrl", editForm.sourceUrl);
    formData.append("inEndlessPool", editForm.inEndlessPool.toString());
    formData.append("scheduledDate", editingPuzzle.scheduledDate || "");

    try {
      const response = await fetch(`${API_BASE}/api/admin/puzzles/${editingPuzzle.id}`, {
        method: "PUT",
        headers: { "X-Admin-Password": password },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to save");
      }

      setEditMessage({ type: "success", text: "Puzzle updated!" });
      await loadCalendar();
      setTimeout(() => setEditingPuzzle(null), 1000);
    } catch (e) {
      setEditMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to save" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedDate) return;

    setSaving(true);
    const formData = new FormData();
    formData.append("date", selectedPuzzleId ? selectedDate : "");

    try {
      if (selectedPuzzleId) {
        await fetch(
          `${API_BASE}/api/admin/puzzles/${selectedPuzzleId}/schedule`,
          {
            method: "POST",
            headers: { "X-Admin-Password": password },
            body: formData,
          }
        );
      } else if (schedule[selectedDate]) {
        // Unschedule current puzzle
        await fetch(
          `${API_BASE}/api/admin/puzzles/${schedule[selectedDate].id}/schedule`,
          {
            method: "POST",
            headers: { "X-Admin-Password": password },
            body: new FormData(), // empty date = unschedule
          }
        );
      }
      await loadCalendar();
      setSelectedDate(null);
    } catch (e) {
      console.error("Failed to schedule puzzle", e);
    } finally {
      setSaving(false);
    }
  };

  const goToPrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  // Generate calendar days
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const days: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  if (loading) {
    return <div style={styles.loading}>Loading calendar...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Daily Calendar</h2>
        <div style={styles.monthNav}>
          <button onClick={goToPrevMonth} style={styles.navButton}>
            ← Prev
          </button>
          <span style={styles.monthLabel}>
            {MONTHS[month - 1]} {year}
          </span>
          <button onClick={goToNextMonth} style={styles.navButton}>
            Next →
          </button>
        </div>
      </div>

      <div style={styles.weekdayRow}>
        {WEEKDAYS.map((day) => (
          <div key={day} style={styles.weekday}>
            {day}
          </div>
        ))}
      </div>

      <div style={styles.calendarGrid}>
        {days.map((day, index) => {
          if (day === null) {
            return (
              <div
                key={`empty-${index}`}
                style={{ ...styles.dayCell, ...styles.dayCellEmpty }}
              />
            );
          }

          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = dateStr === todayStr;
          const puzzle = schedule[dateStr];

          return (
            <div
              key={day}
              onClick={() => handleDayClick(dateStr)}
              style={{
                ...styles.dayCell,
                ...(isToday ? styles.dayCellToday : {}),
                ...(puzzle ? styles.dayCellScheduled : {}),
              }}
            >
              <div style={styles.dayNumber}>{day}</div>
              {puzzle && (
                <img
                  src={puzzle.imageUrl}
                  alt={puzzle.answer}
                  style={styles.dayThumbnail}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Assignment Modal */}
      {selectedDate && (
        <div style={styles.modal} onClick={() => setSelectedDate(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>
              Assign Puzzle for {selectedDate}
            </h3>

            <div style={{ maxHeight: "300px", overflow: "auto" }}>
              {/* Unassign option */}
              <div
                onClick={() => setSelectedPuzzleId(null)}
                style={{
                  ...styles.puzzleOption,
                  ...(selectedPuzzleId === null ? styles.puzzleOptionSelected : {}),
                }}
              >
                <div style={styles.puzzleOptionInfo}>
                  <div style={styles.puzzleOptionId}>No puzzle</div>
                  <div style={styles.puzzleOptionAnswer}>
                    Leave this day empty
                  </div>
                </div>
              </div>

              {allPuzzles.map((puzzle) => (
                <div
                  key={puzzle.id}
                  onClick={() => setSelectedPuzzleId(puzzle.id)}
                  style={{
                    ...styles.puzzleOption,
                    ...(selectedPuzzleId === puzzle.id ? styles.puzzleOptionSelected : {}),
                  }}
                >
                  <img
                    src={puzzle.imageUrl}
                    alt={puzzle.answer}
                    style={styles.puzzleOptionThumb}
                  />
                  <div style={styles.puzzleOptionInfo}>
                    <div style={styles.puzzleOptionId}>{puzzle.id}</div>
                    <div style={styles.puzzleOptionAnswer}>
                      {puzzle.answer}
                      {puzzle.scheduledDate && puzzle.scheduledDate !== selectedDate && (
                        <span style={{ color: "var(--error)" }}>
                          {" "}(scheduled for {puzzle.scheduledDate})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.buttonRow}>
              <button
                onClick={() => setSelectedDate(null)}
                style={{ ...styles.button, ...styles.buttonSecondary }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={saving}
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingPuzzle && (
        <div style={styles.modal} onClick={() => setEditingPuzzle(null)}>
          <div style={{ ...styles.modalContent, maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>
              Edit Puzzle: {editingPuzzle.id}
            </h3>

            {loadingEdit ? (
              <div style={styles.loading}>Loading...</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Image preview */}
                <div style={{ textAlign: "center" }}>
                  <img
                    src={editingPuzzle.imageUrl}
                    alt={editingPuzzle.answer}
                    style={{ maxWidth: "100%", maxHeight: "150px", borderRadius: "8px" }}
                  />
                </div>

                {/* Answer */}
                <div>
                  <label style={styles.label}>Answer</label>
                  <input
                    type="text"
                    value={editForm.answer}
                    onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                    style={styles.input}
                  />
                </div>

                {/* Hints */}
                <div>
                  <label style={styles.label}>Hints</label>
                  <div style={styles.synonymList}>
                    {(() => {
                      try {
                        const arr = JSON.parse(editForm.hints);
                        return Array.isArray(arr) ? arr : [];
                      } catch {
                        return [];
                      }
                    })().map((hint: string, index: number) => (
                      <div key={index} style={styles.synonymItem}>
                        <input
                          type="text"
                          value={hint}
                          onChange={(e) => {
                            const arr = JSON.parse(editForm.hints);
                            arr[index] = e.target.value;
                            setEditForm({ ...editForm, hints: JSON.stringify(arr) });
                          }}
                          style={{ ...styles.input, flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const arr = JSON.parse(editForm.hints);
                            arr.splice(index, 1);
                            setEditForm({ ...editForm, hints: JSON.stringify(arr) });
                          }}
                          style={styles.buttonDangerSmall}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={styles.addSynonymRow}>
                    <input
                      type="text"
                      placeholder="Add a hint..."
                      style={{ ...styles.input, flex: 1 }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          if (input.value.trim()) {
                            try {
                              const arr = JSON.parse(editForm.hints || "[]");
                              arr.push(input.value.trim());
                              setEditForm({ ...editForm, hints: JSON.stringify(arr) });
                              input.value = "";
                            } catch {
                              setEditForm({ ...editForm, hints: JSON.stringify([input.value.trim()]) });
                              input.value = "";
                            }
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                        if (input.value.trim()) {
                          try {
                            const arr = JSON.parse(editForm.hints || "[]");
                            arr.push(input.value.trim());
                            setEditForm({ ...editForm, hints: JSON.stringify(arr) });
                            input.value = "";
                          } catch {
                            setEditForm({ ...editForm, hints: JSON.stringify([input.value.trim()]) });
                            input.value = "";
                          }
                        }
                      }}
                      style={{ ...styles.button, ...styles.buttonSecondary, padding: "8px 16px" }}
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Synonyms */}
                <div>
                  <label style={styles.label}>Synonyms (alternative answers)</label>
                  <div style={styles.synonymList}>
                    {(() => {
                      try {
                        const arr = JSON.parse(editForm.synonyms);
                        return Array.isArray(arr) ? arr : [];
                      } catch {
                        return [];
                      }
                    })().map((synonym: string, index: number) => (
                      <div key={index} style={styles.synonymItem}>
                        <input
                          type="text"
                          value={synonym}
                          onChange={(e) => {
                            const arr = JSON.parse(editForm.synonyms);
                            arr[index] = e.target.value;
                            setEditForm({ ...editForm, synonyms: JSON.stringify(arr) });
                          }}
                          style={{ ...styles.input, flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const arr = JSON.parse(editForm.synonyms);
                            arr.splice(index, 1);
                            setEditForm({ ...editForm, synonyms: JSON.stringify(arr) });
                          }}
                          style={styles.buttonDangerSmall}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={styles.addSynonymRow}>
                    <input
                      type="text"
                      placeholder="Add a synonym..."
                      style={{ ...styles.input, flex: 1 }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          if (input.value.trim()) {
                            try {
                              const arr = JSON.parse(editForm.synonyms || "[]");
                              arr.push(input.value.trim());
                              setEditForm({ ...editForm, synonyms: JSON.stringify(arr) });
                              input.value = "";
                            } catch {
                              setEditForm({ ...editForm, synonyms: JSON.stringify([input.value.trim()]) });
                              input.value = "";
                            }
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                        if (input.value.trim()) {
                          try {
                            const arr = JSON.parse(editForm.synonyms || "[]");
                            arr.push(input.value.trim());
                            setEditForm({ ...editForm, synonyms: JSON.stringify(arr) });
                            input.value = "";
                          } catch {
                            setEditForm({ ...editForm, synonyms: JSON.stringify([input.value.trim()]) });
                            input.value = "";
                          }
                        }
                      }}
                      style={{ ...styles.button, ...styles.buttonSecondary, padding: "8px 16px" }}
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Source */}
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Source</label>
                    <input
                      type="text"
                      value={editForm.sourceText}
                      onChange={(e) => setEditForm({ ...editForm, sourceText: e.target.value })}
                      style={styles.input}
                      placeholder="e.g., US Census Bureau"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Source URL</label>
                    <input
                      type="url"
                      value={editForm.sourceUrl}
                      onChange={(e) => setEditForm({ ...editForm, sourceUrl: e.target.value })}
                      style={styles.input}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* Max guesses & threshold */}
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Max Guesses</label>
                    <input
                      type="number"
                      value={editForm.maxGuesses}
                      onChange={(e) => setEditForm({ ...editForm, maxGuesses: parseInt(e.target.value) })}
                      style={styles.input}
                      min={1}
                      max={20}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={styles.label}>Similarity Threshold</label>
                    <input
                      type="number"
                      value={editForm.similarityThreshold}
                      onChange={(e) => setEditForm({ ...editForm, similarityThreshold: parseFloat(e.target.value) })}
                      style={styles.input}
                      min={0.5}
                      max={1}
                      step={0.01}
                    />
                  </div>
                </div>

                {/* Answer checking mode */}
                <div>
                  <label style={styles.label}>Answer Checking Mode</label>
                  <div style={styles.modeToggle}>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, similarityMode: "embedding" })}
                      style={{
                        ...styles.modeToggleBtn,
                        ...(editForm.similarityMode === "embedding" ? styles.modeToggleBtnActive : {}),
                      }}
                    >
                      Embedding
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, similarityMode: "llm" })}
                      style={{
                        ...styles.modeToggleBtn,
                        ...(editForm.similarityMode === "llm" ? styles.modeToggleBtnActive : {}),
                      }}
                    >
                      LLM
                    </button>
                  </div>
                </div>

                {/* Endless pool toggle */}
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={editForm.inEndlessPool}
                      onChange={(e) => setEditForm({ ...editForm, inEndlessPool: e.target.checked })}
                      style={{ width: "18px", height: "18px" }}
                    />
                    <span>Include in Endless Pool</span>
                  </label>
                </div>

                {/* Message */}
                {editMessage && (
                  <div style={{
                    color: editMessage.type === "success" ? "var(--success)" : "var(--error)",
                    fontSize: "0.875rem"
                  }}>
                    {editMessage.text}
                  </div>
                )}

                {/* Buttons */}
                <div style={styles.buttonRow}>
                  <button
                    onClick={() => setEditingPuzzle(null)}
                    style={{ ...styles.button, ...styles.buttonSecondary }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => window.open(`/test/${editingPuzzle.id}`, "_blank")}
                    style={{ ...styles.button, ...styles.buttonTest }}
                  >
                    Test
                  </button>
                  {editingPuzzle.scheduledDate && (
                    <button
                      onClick={async () => {
                        const formData = new FormData();
                        formData.append("date", "");
                        await fetch(`${API_BASE}/api/admin/puzzles/${editingPuzzle.id}/schedule`, {
                          method: "POST",
                          headers: { "X-Admin-Password": password },
                          body: formData,
                        });
                        await loadCalendar();
                        setEditingPuzzle(null);
                      }}
                      style={{ ...styles.button, ...styles.buttonDanger }}
                    >
                      Unschedule
                    </button>
                  )}
                  <button
                    onClick={handleSaveEdit}
                    disabled={savingEdit}
                    style={{
                      ...styles.button,
                      ...styles.buttonPrimary,
                      opacity: savingEdit ? 0.5 : 1,
                    }}
                  >
                    {savingEdit ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
