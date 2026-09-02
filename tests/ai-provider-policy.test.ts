import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("chat derives provider execution from authenticated user settings", async () => {
  const route = await readFile("src/app/api/chat/route.ts", "utf8");

  assert.match(route, /const provider = await getProviderForUser\(userId\)/);
  assert.doesNotMatch(route, /provider:\s*providerName/);
  assert.doesNotMatch(route, /getProvider\(providerName\)/);
  assert.doesNotMatch(route, /resolveModel\(providerName/);
});

test("conversation creation rejects provider and model overrides", async () => {
  const route = await readFile("src/app/api/chat/conversations/route.ts", "utf8");

  assert.match(route, /z\.object\([\s\S]*?\)\.strict\(\)/);
  assert.match(route, /getProviderForUser\(session\.user\.id\)/);
  assert.doesNotMatch(route, /provider:\s*z\.enum/);
  assert.doesNotMatch(route, /model:\s*z\.string/);
});

test("cloud AI execution requires a user-owned API key", async () => {
  const provider = await readFile("src/lib/ai/provider.ts", "utf8");

  assert.match(provider, /requireUserKey\(decryptUserKey\(user\?\.openaiApiKey\), 'OpenAI'\)/);
  assert.match(provider, /decryptUserKey\(user\?\.anthropicApiKey\)/);
  assert.match(provider, /Configure your own \$\{provider\} API key/);
});

test("user Ollama execution is pinned to the operator destination", async () => {
  const provider = await readFile("src/lib/ai/provider.ts", "utf8");

  assert.match(provider, /const operatorBaseUrl = process\.env\.OLLAMA_BASE_URL/);
  assert.match(provider, /return new OllamaProvider\(operatorBaseUrl\)/);
  assert.doesNotMatch(provider, /new OllamaProvider\(user\?\.ollamaBaseUrl/);
});

test("settings do not accept or expose tenant-controlled Ollama destinations", async () => {
  const route = await readFile("src/app/api/settings/route.ts", "utf8");
  const page = await readFile("src/app/(app)/settings/page.tsx", "utf8");

  assert.doesNotMatch(route, /ollamaBaseUrl:\s*z\./);
  assert.doesNotMatch(route, /ollamaBaseUrl:\s*user\./);
  assert.match(route, /const updateSettingsSchema = z\.object\([\s\S]*?\)\.strict\(\)/);
  assert.doesNotMatch(page, /setOllamaBaseUrl|Ollama base URL/);
  assert.match(page, /Ollama \(managed by this instance\)/);
});
