import { z } from "zod/v4";

// ─── Shared reusable validators ────────────────────────────────────────────────

const cuid = z.string().regex(/^c[a-z0-9]{24}$/);

// ─── Habit ────────────────────────────────────────────────────────────────────

export const HabitSchema = z.object({
  id: cuid.optional(),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional(),
  icon: z.string().max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "CUSTOM"]).default("DAILY"),
  targetCount: z.number().int().min(1).default(1),
  schedule: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.number().int().default(0),
  archived: z.boolean().default(false),
});

export const HabitLogSchema = z.object({
  id: cuid.optional(),
  habitId: cuid,
  date: z.coerce.date(),
  count: z.number().int().min(0).default(1),
  note: z.string().max(1000).optional(),
});

// ─── Todo ─────────────────────────────────────────────────────────────────────

export const TodoSchema = z.object({
  id: cuid.optional(),
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(10000).optional(),
  status: z
    .enum(["INBOX", "TODO", "IN_PROGRESS", "DONE", "CANCELLED", "SNOOZED"])
    .default("INBOX"),
  priority: z.number().int().min(0).max(5).default(0),
  dueDate: z.coerce.date().optional().nullable(),
  scheduledAt: z.coerce.date().optional().nullable(),
  completedAt: z.coerce.date().optional().nullable(),
  goalId: cuid.optional().nullable(),
  parentId: cuid.optional().nullable(),
  sortOrder: z.number().int().default(0),
  tagIds: z.array(cuid).optional(),
});

// ─── Note ─────────────────────────────────────────────────────────────────────

export const NoteSchema = z.object({
  id: cuid.optional(),
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().max(100000),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional()
    .nullable(),
  icon: z.string().max(50).optional(),
  coverImage: z.string().url().optional().nullable(),
  parentId: cuid.optional().nullable(),
  isPublished: z.boolean().default(false),
  publishedAt: z.coerce.date().optional().nullable(),
  sortOrder: z.number().int().default(0),
  archived: z.boolean().default(false),
  tagIds: z.array(cuid).optional(),
});

// ─── Goal ──────────────────────────────────────────────────────────────────────

export const GoalSchema = z.object({
  id: cuid.optional(),
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(10000).optional(),
  status: z
    .enum(["ACTIVE", "COMPLETED", "ABANDONED", "ON_HOLD"])
    .default("ACTIVE"),
  level: z.enum(["YEARLY", "QUARTERLY", "MONTHLY", "WEEKLY"]).default(
    "QUARTERLY"
  ),
  parentId: cuid.optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  progress: z.number().int().min(0).max(100).default(0),
  tagIds: z.array(cuid).optional(),
});

// ─── Journal ───────────────────────────────────────────────────────────────────

export const JournalSchema = z.object({
  id: cuid.optional(),
  date: z.coerce.date(),
  content: z.string().min(1, "Content is required").max(50000),
  mood: z.number().int().min(1).max(10).optional().nullable(),
  gratitude: z.string().max(5000).optional().nullable(),
  highlights: z.string().max(5000).optional().nullable(),
  tagIds: z.array(cuid).optional(),
});

// ─── Calendar Event ───────────────────────────────────────────────────────────

export const CalendarEventSchema = z.object({
  id: cuid.optional(),
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(10000).optional(),
  location: z.string().max(500).optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional().nullable(),
  allDay: z.boolean().default(false),
  recurrence: z.string().max(500).optional(),
  color: z.string().max(20).optional(),
  source: z.string().max(50).optional(),
  externalId: z.string().max(200).optional(),
  tagIds: z.array(cuid).optional(),
});

// ─── Inbox Item ───────────────────────────────────────────────────────────────

export const InboxItemSchema = z.object({
  id: cuid.optional(),
  content: z.string().min(1, "Content is required").max(20000),
  source: z
    .enum(["MANUAL", "AI_CHAT", "EMAIL", "WEB_CLIPPER", "PLUGIN"])
    .default("MANUAL"),
  type: z
    .enum(["THOUGHT", "LINK", "IMAGE", "TASK", "NOTE"])
    .default("THOUGHT"),
  processed: z.boolean().default(false),
  processedAt: z.coerce.date().optional().nullable(),
  linkedId: z.string().max(200).optional().nullable(),
});

// ─── Tag ──────────────────────────────────────────────────────────────────────

export const TagSchema = z.object({
  id: cuid.optional(),
  name: z.string().min(1, "Name is required").max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
});

// ─── Inferred types ────────────────────────────────────────────────────────────

export type HabitInput = z.infer<typeof HabitSchema>;
export type HabitLogInput = z.infer<typeof HabitLogSchema>;
export type TodoInput = z.infer<typeof TodoSchema>;
export type NoteInput = z.infer<typeof NoteSchema>;
export type GoalInput = z.infer<typeof GoalSchema>;
export type JournalInput = z.infer<typeof JournalSchema>;
export type CalendarEventInput = z.infer<typeof CalendarEventSchema>;
export type InboxItemInput = z.infer<typeof InboxItemSchema>;
export type TagInput = z.infer<typeof TagSchema>;