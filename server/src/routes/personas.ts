import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db.js";
import type { Persona } from "../types.js";

export const personasRouter = Router();

personasRouter.get("/", (_req, res) => {
  res.json(db.get().personas.sort((a, b) => a.createdAt - b.createdAt));
});

personasRouter.post("/", (req, res) => {
  const { name, systemPrompt, model, avatarColor, voiceURI } = req.body ?? {};
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
    createdAt: Date.now(),
  };
  db.mutate((s) => s.personas.push(persona));
  res.status(201).json(persona);
});

personasRouter.put("/:id", (req, res) => {
  const { id } = req.params;
  const updated = db.mutate((s) => {
    const persona = s.personas.find((p) => p.id === id);
    if (!persona) return null;
    const { name, systemPrompt, model, avatarColor, voiceURI } = req.body ?? {};
    if (name !== undefined) persona.name = name;
    if (systemPrompt !== undefined) persona.systemPrompt = systemPrompt;
    if (model !== undefined) persona.model = model;
    if (avatarColor !== undefined) persona.avatarColor = avatarColor;
    if (voiceURI !== undefined) persona.voiceURI = voiceURI || undefined;
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
