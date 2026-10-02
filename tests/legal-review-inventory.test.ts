import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const inventory = readFileSync("LEGAL-REVIEW-INVENTORY.md", "utf8");
const inventoryText = inventory.replace(/\*\*/g, "");
const license = readFileSync("LICENSE", "utf8");

test("legal inventory remains internal review material rather than approved policy", () => {
  assert.match(inventory, /not legal advice/i);
  assert.match(inventoryText, /Nothing in this file authorizes publication/i);
  assert.match(inventoryText, /factual engineering inventory only/i);
  assert.match(inventoryText, /qualified review/i);
});

test("legal inventory keeps the unresolved owner decisions explicit", () => {
  for (const decision of [
    "Operating identity",
    "Primary jurisdiction",
    "Privacy owner",
    "Copyright holder",
    "Managed-beta hosting provider",
    "Approved transactional-email provider",
    "Backup retention",
  ]) {
    assert.match(inventory, new RegExp(decision, "i"));
  }
  assert.match(inventory, /OWNER DECISION REQUIRED/);
});

test("inventory records the material data lifecycle and provider review areas", () => {
  assert.match(inventory, /Portable export behaviour/);
  assert.match(inventory, /Account deletion behaviour/);
  assert.match(inventoryText, /does not by itself prove deletion from previously created backups/i);
  assert.match(inventory, /Product analytics/);
  assert.match(inventory, /AI provider data flow/);
  assert.match(inventory, /Anthropic/);
  assert.match(inventory, /OpenAI/);
  assert.match(inventory, /Ollama/);
  assert.match(inventory, /Transactional email/);
});

test("license ownership remains intentionally unresolved until owner approval", () => {
  assert.match(license, /Copyright \(c\) \[year\] \[fullname\]/);
  assert.match(inventory, /Do \*\*not\*\* replace the placeholder/i);
});
