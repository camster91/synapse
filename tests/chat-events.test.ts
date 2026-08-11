import assert from "node:assert/strict";
import test from "node:test";
import { parseChatEvent, serializeTextEvent } from "../src/lib/ai/events";

test("chat text events use content as the client contract", () => {
  const event = parseChatEvent(serializeTextEvent("Ready for today"));

  assert.deepEqual(event, { type: "text", content: "Ready for today" });
});
