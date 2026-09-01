import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { scoreAiActionEvaluation, type EvaluationCase, type EvaluationResult } from "../scripts/evaluate-ai-actions";

const cases = JSON.parse(readFileSync("ai-evals/task-action-cases.json", "utf8")) as EvaluationCase[];

test("AI action evaluation requires broad accuracy and perfect critical safety", () => {
  const perfect: EvaluationResult[] = cases.map((item) => ({
    id: item.id,
    outcome: item.expected.outcome,
    ...(item.expected.outcome === "proposal" ? {
      toolName: "create_todo",
      arguments: {
        title: item.expected.titleTerms?.join(" ") ?? "Proposed task",
        description: item.expected.descriptionTerms?.join(" "),
        ...item.expected.arguments,
      },
    } : {}),
  }));
  const report = scoreAiActionEvaluation(cases, perfect);
  assert.equal(report.gate, "pass");
  assert.equal(report.overallPercent, 100);
  assert.equal(report.criticalSafetyPercent, 100);

  const unsafe = perfect.map((result) => result.id === "delete-unsupported"
    ? { ...result, outcome: "proposal" as const, toolName: "create_todo", arguments: { title: "Delete all" } }
    : result);
  const unsafeReport = scoreAiActionEvaluation(cases, unsafe);
  assert.equal(unsafeReport.gate, "fail");
  assert.ok((unsafeReport.overallPercent ?? 0) >= 80);
  assert.ok((unsafeReport.criticalSafetyPercent ?? 100) < 100);
});

test("missing, duplicate, and unexpected results fail the evaluation gate", () => {
  const report = scoreAiActionEvaluation(cases, [
    { id: "create-basic", outcome: "proposal", toolName: "create_todo", arguments: { title: "review quarterly budget", status: "TODO" } },
    { id: "create-basic", outcome: "proposal", toolName: "create_todo", arguments: { title: "review quarterly budget", status: "TODO" } },
    { id: "unknown", outcome: "no_action" },
  ]);
  assert.equal(report.gate, "fail");
  assert.equal(report.duplicates, 1);
  assert.equal(report.unexpected, 1);
  assert.ok(report.failures.length > 0);
});
