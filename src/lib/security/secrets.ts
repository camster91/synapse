import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function keyBuffer(key: string): Buffer {
  const buffer = Buffer.from(key, "utf8");
  if (buffer.length !== 32) {
    throw new Error("SYNAPSE_ENCRYPTION_KEY must be exactly 32 UTF-8 bytes");
  }
  return buffer;
}

export function encryptSecret(plaintext: string, key: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyBuffer(key), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${VERSION}:${iv.toString("base64url")}:${authTag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptSecret(value: string, key: string): string {
  if (!value.startsWith(`${VERSION}:`)) return value;

  try {
    const [, encodedIv, encodedTag, encodedCiphertext] = value.split(":");
    if (!encodedIv || !encodedTag || !encodedCiphertext) throw new Error("Malformed secret");

    const iv = Buffer.from(encodedIv, "base64url");
    const authTag = Buffer.from(encodedTag, "base64url");
    if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) throw new Error("Malformed secret");

    const decipher = createDecipheriv("aes-256-gcm", keyBuffer(key), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Unable to decrypt secret");
  }
}
