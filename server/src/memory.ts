import { nanoid } from "nanoid";
import { db } from "./db.js";
import { chatOnce, embed, type ChatMessage } from "./ollama.js";
import type { Memory } from "./types.js";

const EMBED_MODEL = process.env.EMBED_MODEL ?? "nomic-embed-text";
const RELEVANT_MEMORY_COUNT = 5;
const SIMILARITY_THRESHOLD = 0.5;
const EXTRACT_EVERY_N_USER_MESSAGES = 4;

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Finds stored long-term memories for a persona that are semantically
 * relevant to the given text. Fails soft (returns []) if embeddings
 * aren't available, e.g. the embedding model isn't pulled in Ollama.
 */
export async function retrieveRelevantMemories(personaId: string, queryText: string): Promise<Memory[]> {
  const memories = db.get().memories.filter((m) => m.personaId === personaId);
  if (memories.length === 0) return [];

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embed(EMBED_MODEL, queryText);
  } catch {
    return [];
  }
  if (queryEmbedding.length === 0) return [];

  return memories
    .map((m) => ({ memory: m, score: cosineSimilarity(queryEmbedding, m.embedding) }))
    .filter((entry) => entry.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, RELEVANT_MEMORY_COUNT)
    .map((entry) => entry.memory);
}

/**
 * Occasionally asks the model to distill a standalone fact worth
 * remembering long-term from recent conversation, and stores it with
 * its embedding. Runs every few user turns; no-ops on failure so it
 * never blocks the chat response.
 */
export async function maybeExtractMemory(
  personaId: string,
  model: string,
  recentMessages: ChatMessage[]
): Promise<void> {
  const userTurns = recentMessages.filter((m) => m.role === "user").length;
  if (userTurns === 0 || userTurns % EXTRACT_EVERY_N_USER_MESSAGES !== 0) return;

  const extractionPrompt: ChatMessage[] = [
    {
      role: "system",
      content:
        "You extract durable facts worth remembering long-term from a conversation " +
        "(preferences, names, relationships, ongoing plans, important context). " +
        "Reply with ONE short sentence stating the single most important new fact. " +
        "If nothing durable and new stands out, reply with exactly: NONE",
    },
    ...recentMessages,
  ];

  try {
    const fact = (await chatOnce(model, extractionPrompt)).trim();
    if (!fact || fact.toUpperCase() === "NONE") return;

    const embedding = await embed(EMBED_MODEL, fact).catch(() => []);
    if (embedding.length === 0) return;

    const memory: Memory = {
      id: nanoid(),
      personaId,
      content: fact,
      embedding,
      createdAt: Date.now(),
    };
    db.mutate((s) => s.memories.push(memory));
  } catch {
    // Extraction is best-effort; never let it break the chat flow.
  }
}

/** Adds a memory the user typed in directly, embedding it the same way auto-extracted ones are. */
export async function addManualMemory(personaId: string, content: string): Promise<Memory> {
  const embedding = await embed(EMBED_MODEL, content).catch(() => []);
  const memory: Memory = { id: nanoid(), personaId, content, embedding, createdAt: Date.now() };
  db.mutate((s) => s.memories.push(memory));
  return memory;
}

/** Re-embeds a memory after its text changes, so retrieval stays accurate. */
export async function updateMemoryContent(id: string, content: string): Promise<Memory | null> {
  const embedding = await embed(EMBED_MODEL, content).catch(() => []);
  return db.mutate((s) => {
    const memory = s.memories.find((m) => m.id === id);
    if (!memory) return null;
    memory.content = content;
    if (embedding.length > 0) memory.embedding = embedding;
    return memory;
  });
}
