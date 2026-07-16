import { Router } from "express";
import { nanoid } from "nanoid";
import { CharacterCardError, exportPersonaAsCard, importCharacterCard } from "../characterCard.js";
import { db } from "../db.js";
import { addManualMemory } from "../memory.js";
import type { Memory, Persona } from "../types.js";

export const personasRouter = Router();

const EDITABLE_FIELDS = [
  "name",
  "systemPrompt",
  "model",
  "avatarColor",
  "voiceURI",
  "avatarImage",
  "temperature",
  "maxTokens",
  "appearance",
  "styleReferenceImage",
] as const;

function toClientMemory(m: Memory) {
  const { embedding: _embedding, ...rest } = m;
  return rest;
}

personasRouter.get("/", (_req, res) => {
  res.json(db.get().personas.sort((a, b) => a.createdAt - b.createdAt));
});

personasRouter.post("/", (req, res) => {
  const {
    name,
    systemPrompt,
    model,
    avatarColor,
    voiceURI,
    avatarImage,
    temperature,
    maxTokens,
    appearance,
    styleReferenceImage,
  } = req.body ?? {};
  if (!name || !systemPrompt || !model) {
    res.status(400).json({ error: "name, systemPrompt and model are required" });
    return;
  }

  const persona: Persona = {
    id: nanoid(),
    name,
    systemPrompt,
    model,
    avatarColor: avatarColor || "#8b5cf6",
    voiceURI: voiceURI || undefined,
    avatarImage: avatarImage || undefined,
    temperature: typeof temperature === "number" ? temperature : undefined,
    maxTokens: typeof maxTokens === "number" ? maxTokens : undefined,
    appearance: appearance || undefined,
    styleReferenceImage: styleReferenceImage || undefined,
    createdAt: Date.now(),
  };
  db.mutate((s) => s.personas.push(persona));
  res.status(201).json(persona);
});

personasRouter.post("/import", (req, res) => {
  try {
    const seed = importCharacterCard(req.body);
    const persona: Persona = { ...seed, id: nanoid(), createdAt: Date.now() };
    db.mutate((s) => s.personas.push(persona));
    res.status(201).json(persona);
  } catch (err) {
    const message = err instanceof CharacterCardError ? err.message : "Could not import character card.";
    res.status(400).json({ error: message });
  }
});

personasRouter.get("/:id/export", (req, res) => {
  const persona = db.get().personas.find((p) => p.id === req.params.id);
  if (!persona) {
    res.status(404).json({ error: "persona not found" });
    return;
  }
  res.json(exportPersonaAsCard(persona));
});

personasRouter.get("/:id/memories", (req, res) => {
  const memories = db
    .get()
    .memories.filter((m) => m.personaId === req.params.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(toClientMemory);
  res.json(memories);
});

personasRouter.post("/:id/memories", async (req, res) => {
  const { id } = req.params;
  const content: string = req.body?.content ?? "";
  if (!content.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }
  const persona = db.get().personas.find((p) => p.id === id);
  if (!persona) {
    res.status(404).json({ error: "persona not found" });
    return;
  }

  const memory = await addManualMemory(id, content.trim());
  res.status(201).json(toClientMemory(memory));
});

personasRouter.put("/:id", (req, res) => {
  const { id } = req.params;
  const updated = db.mutate((s) => {
    const persona = s.personas.find((p) => p.id === id);
    if (!persona) return null;

    const target = persona as unknown as Record<string, unknown>;
    for (const field of EDITABLE_FIELDS) {
      const value = req.body?.[field];
      if (value === undefined) continue;
      if (field === "voiceURI" || field === "avatarImage" || field === "appearance" || field === "styleReferenceImage") {
        target[field] = value || undefined;
      } else {
        target[field] = value;
      }
    }
    return persona;
  });

  if (!updated) {
    res.status(404).json({ error: "persona not found" });
    return;
  }
  res.json(updated);
});

personasRouter.delete("/:id", (req, res) => {
  const { id } = req.params;
  db.mutate((s) => {
    const conversationIds = s.conversations.filter((c) => c.personaId === id).map((c) => c.id);
    s.personas = s.personas.filter((p) => p.id !== id);
    s.conversations = s.conversations.filter((c) => c.personaId !== id);
    s.messages = s.messages.filter((m) => !conversationIds.includes(m.conversationId));
    s.memories = s.memories.filter((m) => m.personaId !== id);
  });
  res.status(204).send();
});
