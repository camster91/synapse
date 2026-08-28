import { z } from 'zod/v4';
import { dateOnlyToUtc, isoDateOrDateTimeSchema, isoDateSchema, isoDateTimeSchema } from '@/lib/date-validation';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';

// ─── Tool Parameter Schemas ──────────────────────────────────────────────────

const createTodoSchema = z.object({
  title: z.string().min(1).max(500).describe('Title of the todo'),
  description: z.string().max(2000).optional().describe('Optional description'),
  priority: z.int().min(0).max(10).default(0).describe('Priority level (0-10)'),
  dueDate: isoDateOrDateTimeSchema.optional().describe('Due date in ISO format'),
  status: z.enum(['INBOX', 'TODO', 'IN_PROGRESS']).default('TODO').describe('Initial status'),
});

const completeTodoSchema = z.object({
  todoId: z.string().describe('ID of the todo to mark as done'),
});

const logHabitSchema = z.object({
  habitId: z.string().describe('ID of the habit to log'),
  count: z.int().min(1).default(1).describe('Number of times completed (default 1)'),
  note: z.string().max(500).optional().describe('Optional note about the habit completion'),
  date: isoDateSchema.optional().describe('Date in ISO format, defaults to today'),
});

const createNoteSchema = z.object({
  title: z.string().min(1).max(200).describe('Title of the note'),
  content: z.string().describe('Content of the note (supports markdown)'),
});

const addInboxItemSchema = z.object({
  content: z.string().min(1).max(5000).describe('Content of the inbox item'),
  type: z.enum(['THOUGHT', 'LINK', 'TASK', 'NOTE']).default('THOUGHT').describe('Type of the item'),
});

const createCalendarEventSchema = z.object({
  title: z.string().min(1).max(200).describe('Title of the event'),
  description: z.string().max(5000).optional().describe('Optional description'),
  location: z.string().max(500).optional().describe('Optional location'),
  startAt: isoDateTimeSchema.describe('Start time in ISO format'),
  endAt: isoDateTimeSchema.optional().describe('End time in ISO format'),
  allDay: z.boolean().default(false).describe('Whether this is an all-day event'),
});

const searchNotesSchema = z.object({
  query: z.string().min(1).describe('Search query for notes'),
  limit: z.int().min(1).max(20).default(5).describe('Max number of results'),
});

const getHabitsStatusSchema = z.object({
  date: isoDateSchema.optional().describe('Date in ISO format, defaults to today'),
});

const getTodosSchema = z.object({
  status: z.enum(['INBOX', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'SNOOZED']).optional()
    .describe('Filter by status'),
  limit: z.int().min(1).max(50).default(10).describe('Max number of results'),
});

const setReminderSchema = z.object({
  message: z.string().min(1).max(500).describe('Reminder message'),
  remindAt: isoDateTimeSchema.describe('When to remind, in ISO format'),
});

// ─── Tool Definitions (for LLM) ─────────────────────────────────────────────

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const toolDefinitions: ToolDef[] = [
  {
    name: 'create_todo',
    description:
      'Create a new todo/task. Use this when the user wants to add a task to their list.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the todo' },
        description: { type: 'string', description: 'Optional description' },
        priority: { type: 'integer', description: 'Priority level (0-10)', default: 0 },
        dueDate: { type: 'string', description: 'Due date in ISO format (YYYY-MM-DD)' },
        status: {
          type: 'string',
          enum: ['INBOX', 'TODO', 'IN_PROGRESS'],
          description: 'Initial status',
          default: 'TODO',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'complete_todo',
    description:
      'Mark an existing todo as completed. Use this when the user says they finished a task.',
    parameters: {
      type: 'object',
      properties: {
        todoId: { type: 'string', description: 'ID of the todo to mark as done' },
      },
      required: ['todoId'],
    },
  },
  {
    name: 'log_habit',
    description:
      'Log a habit completion for today (or a specific date). Use this when the user says they completed a habit.',
    parameters: {
      type: 'object',
      properties: {
        habitId: { type: 'string', description: 'ID of the habit to log' },
        count: { type: 'integer', description: 'Number of times completed (default 1)', default: 1 },
        note: { type: 'string', description: 'Optional note about the habit completion' },
        date: { type: 'string', description: 'Date in ISO format, defaults to today' },
      },
      required: ['habitId'],
    },
  },
  {
    name: 'create_note',
    description:
      'Create a new note. Use this when the user wants to save information or write a note.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the note' },
        content: { type: 'string', description: 'Content of the note (supports markdown)' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'add_inbox_item',
    description:
      'Add an item to the quick capture inbox. Use this when the user has a thought, idea, or thing to process later.',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Content of the inbox item' },
        type: {
          type: 'string',
          enum: ['THOUGHT', 'LINK', 'TASK', 'NOTE'],
          description: 'Type of the item',
          default: 'THOUGHT',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'create_calendar_event',
    description:
      'Create a calendar event. Use this when the user wants to schedule something.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the event' },
        description: { type: 'string', description: 'Optional description' },
        location: { type: 'string', description: 'Optional location' },
        startAt: { type: 'string', description: 'Start time in ISO format' },
        endAt: { type: 'string', description: 'End time in ISO format' },
        allDay: { type: 'boolean', description: 'Whether this is an all-day event', default: false },
      },
      required: ['title', 'startAt'],
    },
  },
  {
    name: 'search_notes',
    description:
      'Search the user\'s notes by content. Use this when the user asks about information they may have saved.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for notes' },
        limit: { type: 'integer', description: 'Max number of results (1-20)', default: 5 },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_habits_status',
    description:
      'Get the status of the user\'s habits for a given date. Use this when the user asks about their habits.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in ISO format, defaults to today' },
      },
      required: [],
    },
  },
  {
    name: 'get_todos',
    description:
      'Get the user\'s todos, optionally filtered by status. Use this when the user asks about their tasks.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['INBOX', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'SNOOZED'],
          description: 'Filter by status',
        },
        limit: { type: 'integer', description: 'Max number of results (1-50)', default: 10 },
      },
      required: [],
    },
  },
  {
    name: 'set_reminder',
    description:
      'Set a reminder. Creates an inbox item with the reminder details for the user to process later.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Reminder message' },
        remindAt: { type: 'string', description: 'When to remind, in ISO format' },
      },
      required: ['message', 'remindAt'],
    },
  },
];

/**
 * Mutating tools stay out of the beta chat loop until the UI can present an
 * explicit confirmation card. Read-only tools are safe to execute immediately.
 */
const READ_ONLY_TOOL_NAMES = new Set(["search_notes", "get_habits_status", "get_todos"]);
export const readOnlyToolDefinitions = toolDefinitions.filter((tool) =>
  READ_ONLY_TOOL_NAMES.has(tool.name)
);

// ─── Tool Executors ──────────────────────────────────────────────────────────

type ExecutorResult = { success: boolean; data: unknown; error?: string };

export const toolExecutors: Record<
  string,
  (userId: string, params: Record<string, unknown>) => Promise<ExecutorResult>
> = {
  create_todo: async (userId, rawParams) => {
    const parsed = createTodoSchema.safeParse(rawParams);
    if (!parsed.success) {
      return { success: false, data: null, error: parsed.error.issues.map((i) => i.message).join(', ') };
    }
    const params = parsed.data;
    const todo = await prisma.todo.create({
      data: {
        userId,
        title: params.title,
        description: params.description,
        priority: params.priority,
        dueDate: params.dueDate ? new Date(params.dueDate) : undefined,
        status: params.status,
      },
    });
    return { success: true, data: { id: todo.id, title: todo.title, status: todo.status } };
  },

  complete_todo: async (userId, rawParams) => {
    const parsed = completeTodoSchema.safeParse(rawParams);
    if (!parsed.success) {
      return { success: false, data: null, error: parsed.error.issues.map((i) => i.message).join(', ') };
    }
    const { todoId } = parsed.data;
    const todo = await prisma.todo.update({
      where: { id: todoId, userId },
      data: { status: 'DONE', completedAt: new Date() },
    });
    return { success: true, data: { id: todo.id, title: todo.title, status: todo.status } };
  },

  log_habit: async (userId, rawParams) => {
    const parsed = logHabitSchema.safeParse(rawParams);
    if (!parsed.success) {
      return { success: false, data: null, error: parsed.error.issues.map((i) => i.message).join(', ') };
    }
    const params = parsed.data;
    const date = params.date
      ? dateOnlyToUtc(params.date)
      : dateOnlyToUtc(new Date().toISOString().slice(0, 10));

    // Verify habit belongs to user
    const habit = await prisma.habit.findFirst({
      where: { id: params.habitId, userId, archived: false },
    });
    if (!habit) {
      return { success: false, data: null, error: 'Habit not found' };
    }

    const log = await prisma.habitLog.upsert({
      where: { habitId_date: { habitId: params.habitId, date } },
      update: { count: params.count, note: params.note },
      create: {
        habitId: params.habitId,
        userId,
        date,
        count: params.count,
        note: params.note,
      },
    });
    return {
      success: true,
      data: { habitId: log.habitId, date: format(date, 'yyyy-MM-dd'), count: log.count },
    };
  },

  create_note: async (userId, rawParams) => {
    const parsed = createNoteSchema.safeParse(rawParams);
    if (!parsed.success) {
      return { success: false, data: null, error: parsed.error.issues.map((i) => i.message).join(', ') };
    }
    const params = parsed.data;
    const note = await prisma.note.create({
      data: {
        userId,
        title: params.title,
        content: params.content,
      },
    });
    return { success: true, data: { id: note.id, title: note.title } };
  },

  add_inbox_item: async (userId, rawParams) => {
    const parsed = addInboxItemSchema.safeParse(rawParams);
    if (!parsed.success) {
      return { success: false, data: null, error: parsed.error.issues.map((i) => i.message).join(', ') };
    }
    const params = parsed.data;
    const item = await prisma.inboxItem.create({
      data: {
        userId,
        content: params.content,
        type: params.type,
        source: 'AI_CHAT',
      },
    });
    return { success: true, data: { id: item.id, content: item.content, type: item.type } };
  },

  create_calendar_event: async (userId, rawParams) => {
    const parsed = createCalendarEventSchema.safeParse(rawParams);
    if (!parsed.success) {
      return { success: false, data: null, error: parsed.error.issues.map((i) => i.message).join(', ') };
    }
    const params = parsed.data;
    if (params.endAt && new Date(params.endAt) <= new Date(params.startAt)) {
      return { success: false, data: null, error: 'Event end must be after its start' };
    }
    const event = await prisma.calendarEvent.create({
      data: {
        userId,
        title: params.title,
        description: params.description,
        location: params.location,
        startAt: new Date(params.startAt),
        endAt: params.endAt ? new Date(params.endAt) : undefined,
        allDay: params.allDay,
        source: 'manual',
      },
    });
    return {
      success: true,
      data: {
        id: event.id,
        title: event.title,
        startAt: event.startAt.toISOString(),
      },
    };
  },

  search_notes: async (userId, rawParams) => {
    const parsed = searchNotesSchema.safeParse(rawParams);
    if (!parsed.success) {
      return { success: false, data: null, error: parsed.error.issues.map((i) => i.message).join(', ') };
    }
    const params = parsed.data;
    const notes = await prisma.note.findMany({
      where: {
        userId,
        archived: false,
        OR: [
          { title: { contains: params.query, mode: 'insensitive' } },
          { content: { contains: params.query, mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: params.limit,
      select: {
        id: true,
        title: true,
        content: true,
        updatedAt: true,
      },
    });
    const results = notes.map((n) => ({
      id: n.id,
      title: n.title,
      preview: n.content.length > 200 ? n.content.slice(0, 200) + '...' : n.content,
      updatedAt: n.updatedAt.toISOString(),
    }));
    return { success: true, data: results };
  },

  get_habits_status: async (userId, rawParams) => {
    const parsed = getHabitsStatusSchema.safeParse(rawParams);
    if (!parsed.success) {
      return { success: false, data: null, error: parsed.error.issues.map((i) => i.message).join(', ') };
    }
    const params = parsed.data;
    const date = params.date ? new Date(params.date) : new Date();
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const [habits, logs] = await Promise.all([
      prisma.habit.findMany({
        where: { userId, archived: false },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, frequency: true, targetCount: true },
      }),
      prisma.habitLog.findMany({
        where: {
          userId,
          date: { gte: dayStart, lte: dayEnd },
        },
        select: { habitId: true, count: true },
      }),
    ]);

    const logMap = new Map(logs.map((l) => [l.habitId, l.count]));
    const status = habits.map((h) => ({
      id: h.id,
      name: h.name,
      frequency: h.frequency,
      targetCount: h.targetCount,
      completed: logMap.has(h.id),
      completedCount: logMap.get(h.id) ?? 0,
    }));

    return { success: true, data: status };
  },

  get_todos: async (userId, rawParams) => {
    const parsed = getTodosSchema.safeParse(rawParams);
    if (!parsed.success) {
      return { success: false, data: null, error: parsed.error.issues.map((i) => i.message).join(', ') };
    }
    const params = parsed.data;
    const todos = await prisma.todo.findMany({
      where: {
        userId,
        ...(params.status ? { status: params.status } : { status: { in: ['INBOX', 'TODO', 'IN_PROGRESS'] } }),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: params.limit,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
      },
    });
    return { success: true, data: todos };
  },

  set_reminder: async (userId, rawParams) => {
    const parsed = setReminderSchema.safeParse(rawParams);
    if (!parsed.success) {
      return { success: false, data: null, error: parsed.error.issues.map((i) => i.message).join(', ') };
    }
    const params = parsed.data;
    // Store reminders as inbox items with the reminder details
    const item = await prisma.inboxItem.create({
      data: {
        userId,
        content: `REMINDER: ${params.message} (Scheduled for: ${params.remindAt})`,
        type: 'TASK',
        source: 'AI_CHAT',
      },
    });
    return {
      success: true,
      data: {
        id: item.id,
        message: params.message,
        remindAt: params.remindAt,
      },
    };
  },
};
