export type ChatTextEvent = { type: "text"; content: string };

export function serializeTextEvent(content: string): string {
  return JSON.stringify({ type: "text", content } satisfies ChatTextEvent);
}

export function parseChatEvent(payload: string): ChatTextEvent {
  const value = JSON.parse(payload) as Partial<ChatTextEvent>;
  if (value.type !== "text" || typeof value.content !== "string") {
    throw new Error("Invalid chat text event");
  }
  return { type: "text", content: value.content };
}
