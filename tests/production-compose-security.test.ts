import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prod = readFileSync(path.join(root, "docker-compose.prod.yml"), "utf8");
const vps = readFileSync(path.join(root, "docker-compose.vps.yml"), "utf8");

test("production database credentials fail closed", () => {
  assert.match(prod, /POSTGRES_USER: \$\{POSTGRES_USER:\?[^}]+\}/);
  assert.match(prod, /POSTGRES_PASSWORD: \$\{POSTGRES_PASSWORD:\?[^}]+\}/);
  assert.match(prod, /POSTGRES_DB: \$\{POSTGRES_DB:\?[^}]+\}/);
  assert.match(vps, /POSTGRES_PASSWORD: \$\{POSTGRES_PASSWORD:\?[^}]+\}/);
  assert.doesNotMatch(prod, /POSTGRES_(?:USER|PASSWORD|DB): \$\{[^}]+:-/);
});

test("production application secrets and connection settings fail closed", () => {
  for (const variable of [
    "DATABASE_URL",
    "NEXTAUTH_URL",
    "NEXTAUTH_SECRET",
    "SYNAPSE_ENCRYPTION_KEY",
  ]) {
    const requiredSetting = new RegExp(`${variable}[:=]\\s*\\$\\{${variable}:\\?[^}]+\\}`);
    assert.match(prod, requiredSetting);
    assert.match(vps, requiredSetting);
  }
});

test("production images receive explicit authentication email settings", () => {
  for (const variable of [
    "AUTH_PUBLIC_URL",
    "EMAIL_PROVIDER",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "EMAIL_REPLY_TO",
  ]) {
    assert.match(prod, new RegExp(`${variable}=\\$\\{${variable}:-\\}`));
    assert.match(vps, new RegExp(`${variable}: \\$\\{${variable}:-\\}`));
  }
  assert.doesNotMatch(prod, /RESEND_API_KEY=[^$\n]+/);
  assert.doesNotMatch(vps, /RESEND_API_KEY: [^$\n]+/);
  assert.doesNotMatch(prod, /AUTH_EMAIL_FILE_DIR/);
  assert.doesNotMatch(vps, /AUTH_EMAIL_FILE_DIR/);
});

test("production PostgreSQL is not published on a host port", () => {
  const dbService = prod.slice(prod.indexOf("  db:"), prod.indexOf("volumes:", prod.indexOf("  db:")));
  assert.doesNotMatch(dbService, /\n\s+ports:/);
  assert.doesNotMatch(prod, /5432:5432/);
});

test("production database healthcheck uses configured database identity", () => {
  assert.match(
    prod,
    /pg_isready -U \$\$\{POSTGRES_USER\} -d \$\$\{POSTGRES_DB\}/
  );
});
