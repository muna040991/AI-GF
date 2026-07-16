import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StoreShape } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "data");
const DATA_FILE = join(DATA_DIR, "store.json");

function emptyStore(): StoreShape {
  return { personas: [], conversations: [], messages: [], memories: [], seededPersonaNames: [] };
}

function load(): StoreShape {
  if (!existsSync(DATA_FILE)) return emptyStore();
  try {
    const raw = readFileSync(DATA_FILE, "utf-8");
    return { ...emptyStore(), ...JSON.parse(raw) };
  } catch {
    return emptyStore();
  }
}

function save(store: StoreShape) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
}

// All local data lives in a single JSON file on disk. This is a
// single-user, local-only app, so a simple load/mutate/save cycle
// (no concurrent writers) is sufficient and avoids native deps.
let store = load();

export const db = {
  get(): StoreShape {
    return store;
  },
  mutate<T>(fn: (s: StoreShape) => T): T {
    const result = fn(store);
    save(store);
    return result;
  },
  /** Wholesale-replaces the store (e.g. restoring from a backup) and persists it. */
  replace(next: StoreShape): void {
    store = { ...emptyStore(), ...next };
    save(store);
  },
};
