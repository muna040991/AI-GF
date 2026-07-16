import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { db } from "./db.js";
import type { StoreShape } from "./types.js";

export class BackupError extends Error {}

interface BackupEnvelope {
  version: 1;
  salt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

/** Encrypts the entire local store with a passphrase (AES-256-GCM, scrypt-derived key). */
export function exportEncryptedBackup(passphrase: string): BackupEnvelope {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(db.get()), "utf-8"), cipher.final()]);

  return {
    version: 1,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function isEnvelope(v: unknown): v is BackupEnvelope {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.salt === "string" &&
    typeof e.iv === "string" &&
    typeof e.authTag === "string" &&
    typeof e.ciphertext === "string"
  );
}

/** Decrypts a backup envelope and replaces the entire local store with its contents. */
export function importEncryptedBackup(passphrase: string, envelope: unknown): void {
  if (!isEnvelope(envelope)) throw new BackupError("That doesn't look like a valid AI-GF backup file.");

  try {
    const key = scryptSync(passphrase, Buffer.from(envelope.salt, "base64"), 32);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf-8");

    const parsed = JSON.parse(plaintext) as StoreShape;
    db.replace(parsed);
  } catch {
    throw new BackupError("Wrong passphrase, or the backup file is corrupted.");
  }
}
