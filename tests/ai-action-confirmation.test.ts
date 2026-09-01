import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { prepareActionProposal } from "../src/lib/ai/tools";
import { summarizeAiActionMetrics } from "../scripts/ai-action-metrics";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const chatRoute = readFileSync("src/app/api/chat/route.ts", "utf8");
const actionRoute = readFileSync("src/app/api/chat/actions/[id]/route.ts", "utf8");
const chatPage = readFileSync("src/app/(app)/chat/page.tsx", "utf8");
const exportRoute = readFileSync("src/app/api/settings/export/route.ts", "utf8");

test("only validated task creation is exposed as a confirmable AI mutation", () => {
  const valid = prepareActionProposal("create_todo", { title: "Review budget", priority: 3 });
  assert.equal(valid.success, true);
  assert.equal(valid.success && valid.summary, "Create task: Review budget");
  assert.equal(prepareActionProposal("create_note", { title: "x", content: "y" }).success, false);
  assert.equal(prepareActionProposal("create_todo", { title: "" }).success, false);
  assert.match(chatRoute, /tools: confirmableToolDefinitions/);
  assert.match(chatRoute, /isReadOnlyToolName\(toolName\) && executor/);
  assert.match(chatPage, /action\.details\.priority/);
  assert.match(chatPage, /action\.details\.dueDate/);
});

test("AI actions are durable, tenant-scoped, expiring, and single-claim", () => {
  assert.match(schema, /model AiActionProposal/);
  assert.match(schema, /status\s+AiActionStatus @default\(PENDING\)/);
  assert.match(schema, /user User @relation/);
  assert.match(actionRoute, /where: \{ id, userId: session\.user\.id \}/);
  assert.match(actionRoute, /status: "PENDING"/);
  assert.match(actionRoute, /claimed\.count !== 1/);
  assert.match(actionRoute, /expiresAt: \{ gt: now \}/);
  assert.match(actionRoute, /expiresAt: \{ lte: now \}/);
});

test("confirmation is explicit and undo refuses to remove an edited task", () => {
  assert.match(chatPage, /> Confirm/);
  assert.match(chatPage, /> Reject/);
  assert.match(chatPage, /> Undo creation/);
  assert.match(chatPage, /Nothing has changed yet/);
  assert.match(actionRoute, /todo\.updatedAt\.toISOString\(\) !== result\.todoUpdatedAt/);
  assert.match(actionRoute, /attachments: true, tags: true, subtasks: true/);
  assert.match(actionRoute, /todo\._count\.attachments \|\| todo\._count\.tags \|\| todo\._count\.subtasks/);
  assert.match(actionRoute, /ACTION_CHANGED/);
  assert.match(actionRoute, /10 \* 60 \* 1000/);
});

test("portable export includes the user's AI proposal and decision history", () => {
  assert.match(exportRoute, /actionProposals: true/);
});

test("AI action reporting aggregates decisions without proposal or identity data", () => {
  const report = summarizeAiActionMetrics(["APPLIED", "UNDONE", "REJECTED", "EXPIRED", "PENDING"]);
  assert.equal(report.confirmed, 2);
  assert.equal(report.decided, 3);
  assert.equal(report.confirmationRatePercent, 66.7);
  assert.equal(report.undoRateAmongConfirmedPercent, 50);
  assert.doesNotMatch(JSON.stringify(report), /userId|email|accountId/i);
  assert.match(report.interpretation, /does not replace/i);
});
