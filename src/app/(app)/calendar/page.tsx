"use client";

import { useState, useEffect } from "react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import Modal from "@/components/Modal";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  color: string | null;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [showEvent, setShowEvent] = useState<CalendarEvent | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newAllDay, setNewAllDay] = useState(false);
  const [newLocation, setNewLocation] = useState("");

  useEffect(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    fetch(`/api/calendar?from=${start.toISOString()}&to=${end.toISOString()}`)
      .then((r) => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data : (data.events || [])))
      .catch(() => {});
  }, [currentDate]);

  const addEvent = async () => {
    if (!newTitle.trim()) return;
    const res = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        startAt: new Date(newStart).toISOString(),
        endAt: newEnd ? new Date(newEnd).toISOString() : undefined,
        allDay: newAllDay,
        location: newLocation || undefined,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setEvents([...events, data]);
      setNewTitle("");
      setNewStart("");
      setNewEnd("");
      setNewLocation("");
      setNewAllDay(false);
      setShowAdd(false);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    const prevEvents = events;
    setEvents(events.filter((e) => e.id !== id));
    setShowEvent(null);
    try {
      const res = await fetch(`/api/calendar/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete event");
    } catch {
      setEvents(prevEvents);
      alert("Failed to delete event. Please try again.");
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const days = Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - firstDay + 1;
    if (dayNum < 1 || dayNum > daysInMonth) return null;
    return dayNum;
  });

  const getEventsForDay = (day: number) =>
    events.filter((e) => {
      const d = new Date(e.startAt);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your schedule</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Event
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Month Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-foreground">
            {currentDate.toLocaleString("default", { month: "long", year: "numeric" })}
          </h2>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="p-2 text-center text-sm font-medium text-muted-foreground border-b border-border">
              {d}
            </div>
          ))}

          {/* Day Cells */}
          {days.map((day, i) => {
            if (!day) return <div key={i} className="min-h-24 bg-muted/30 border-b border-r border-border" />;
            const dayEvents = getEventsForDay(day);
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

            return (
              <button
                type="button"
                aria-label={`${new Date(year, month, day).toLocaleDateString()}: ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}
                key={i}
                className="min-h-24 p-1 border-b border-r border-border hover:bg-muted/20 transition-colors cursor-pointer text-left"
                onClick={() => {
                  if (dayEvents.length > 0) setShowEvent(dayEvents[0]);
                }}
              >
                <div className={`text-sm p-1 ${isToday ? "w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center" : "text-foreground"}`}>
                  {day}
                </div>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate"
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-muted-foreground px-1">+{dayEvents.length - 2} more</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Add Event Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="New Event">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Event title"
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground mb-1">Start</label>
              <input
                type="datetime-local"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground mb-1">End</label>
              <input
                type="datetime-local"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Location (optional)</label>
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="Where?"
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={newAllDay}
              onChange={(e) => setNewAllDay(e.target.checked)}
              className="rounded border-input"
            />
            All day event
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={addEvent}
              disabled={!newTitle.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Create Event
            </button>
          </div>
        </div>
      </Modal>

      {/* Event Detail Modal */}
      <Modal isOpen={showEvent !== null} onClose={() => setShowEvent(null)} title={showEvent?.title || ""}>
        {showEvent && (
          <div className="space-y-4">
            <div className="space-y-2">
              {showEvent.startAt && (
                <p className="text-sm text-foreground">
                  <span className="font-medium">When:</span>{" "}
                  {new Date(showEvent.startAt).toLocaleString()}
                </p>
              )}
              {showEvent.location && (
                <p className="text-sm text-foreground">
                  <span className="font-medium">Where:</span> {showEvent.location}
                </p>
              )}
              {showEvent.description && (
                <p className="text-sm text-muted-foreground">{showEvent.description}</p>
              )}
            </div>
            <button
              onClick={() => deleteEvent(showEvent.id)}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors"
            >
              Delete Event
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
