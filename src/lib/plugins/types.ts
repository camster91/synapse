// ─── Permissions ──────────────────────────────────────────────────────────────

export type PluginPermission =
  | "read:habits" | "write:habits"
  | "read:todos" | "write:todos"
  | "read:notes" | "write:notes"
  | "read:journal" | "write:journal"
  | "read:calendar" | "write:calendar"
  | "read:goals" | "write:goals"
  | "read:inbox" | "write:inbox"
  | "read:profile" | "write:profile"
  | "access:ai";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface ConfigFieldDefinition {
  type: "string" | "number" | "boolean" | "select";
  label: string;
  default?: unknown;
  required?: boolean;
  options?: string[]; // for select type
}

// ─── Data types passed to hooks ──────────────────────────────────────────────
// These are plain-object snapshots of the relevant Prisma models so plugins
// don't need to depend on generated types directly.

export interface HabitLogData {
  id: string;
  habitId: string;
  userId: string;
  date: Date;
  count: number;
  note: string | null;
  createdAt: Date;
}

export interface TodoData {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  dueDate: Date | null;
  scheduledAt: Date | null;
  completedAt: Date | null;
  goalId: string | null;
  parentId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteData {
  id: string;
  userId: string;
  title: string;
  content: string;
  slug: string | null;
  icon: string | null;
  coverImage: string | null;
  parentId: string | null;
  isPublished: boolean;
  publishedAt: Date | null;
  sortOrder: number;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface JournalData {
  id: string;
  userId: string;
  date: Date;
  content: string;
  mood: number | null;
  gratitude: string | null;
  highlights: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface XpTransactionData {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  referenceId: string | null;
  createdAt: Date;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export interface PluginContext {
  userId: string;
  db: PermissionScopedDb;
  config: Record<string, unknown>;
  logger: PluginLogger;
}

export interface PluginLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

export interface DailyReviewResult {
  summary?: string;
  suggestions?: string[];
}

export interface PluginHooks {
  onHabitCompleted?: (habit: HabitLogData, context: PluginContext) => Promise<void>;
  onTodoCompleted?: (todo: TodoData, context: PluginContext) => Promise<void>;
  onNoteCreated?: (note: NoteData, context: PluginContext) => Promise<void>;
  onJournalEntry?: (journal: JournalData, context: PluginContext) => Promise<void>;
  onDailyReview?: (context: PluginContext) => Promise<DailyReviewResult>;
  onXpEarned?: (transaction: XpTransactionData, context: PluginContext) => Promise<void>;
}

// ─── Routes & Widgets ─────────────────────────────────────────────────────────

export interface PluginRoute {
  path: string; // e.g. "/plugins/finance"
  component: string; // React component path relative to plugin dir
}

export interface PluginWidget {
  id: string;
  title: string;
  location: "dashboard" | "sidebar" | "note-sidebar";
  component: string;
}

// ─── Manifest ─────────────────────────────────────────────────────────────────

export interface PluginManifest {
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;
  icon?: string;
  homepage?: string;
  permissions: PluginPermission[];
  configSchema?: Record<string, ConfigFieldDefinition>;
  hooks?: PluginHooks;
  routes?: PluginRoute[];
  widgets?: PluginWidget[];
}

// ─── Permission-scoped DB proxy ───────────────────────────────────────────────
//
// Each method returns a Promise (like Prisma), but the proxy only exposes
// methods matching the plugin's declared permissions.

export interface PermissionScopedDb {
  habit: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>;
  };
  habitLog: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>;
    create: (args: Record<string, unknown>) => Promise<unknown>;
  };
  todo: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>;
    create: (args: Record<string, unknown>) => Promise<unknown>;
    update: (args: Record<string, unknown>) => Promise<unknown>;
  };
  note: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>;
    create: (args: Record<string, unknown>) => Promise<unknown>;
    update: (args: Record<string, unknown>) => Promise<unknown>;
  };
  journal: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>;
    create: (args: Record<string, unknown>) => Promise<unknown>;
  };
  calendarEvent: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>;
    create: (args: Record<string, unknown>) => Promise<unknown>;
    update: (args: Record<string, unknown>) => Promise<unknown>;
  };
  goal: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>;
  };
  inboxItem: {
    findMany: (args?: Record<string, unknown>) => Promise<unknown[]>;
    create: (args: Record<string, unknown>) => Promise<unknown>;
  };
  user: {
    findUnique: (args: Record<string, unknown>) => Promise<unknown | null>;
  };
}

// ─── Hook names (for executor dispatch) ──────────────────────────────────────

export type HookName = keyof PluginHooks;

export const HOOK_NAMES: HookName[] = [
  "onHabitCompleted",
  "onTodoCompleted",
  "onNoteCreated",
  "onJournalEntry",
  "onDailyReview",
  "onXpEarned",
] as const;