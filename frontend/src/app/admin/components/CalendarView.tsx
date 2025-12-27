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
};

export default function CalendarView({ password }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [schedule, setSchedule] = useState<Record<string, ScheduledPuzzle>>({});
  const [loading, setLoading] = useState(true);

  // Modal state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [allPuzzles, setAllPuzzles] = useState<Puzzle[]>([]);
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    setSelectedDate(date);
    setSelectedPuzzleId(schedule[date]?.id || null);
    await loadAllPuzzles();
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
    </div>
  );
}
