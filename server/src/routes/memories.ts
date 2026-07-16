import { Router } from "express";
import { db } from "../db.js";
import { updateMemoryContent } from "../memory.js";
import type { Memory } from "../types.js";

export const memoriesRouter = Router();

function toClientMemory(m: Memory) {
  const { embedding: _embedding, ...rest } = m;
  return rest;
}

memoriesRouter.put("/:id", async (req, res) => {
  const { id } = req.params;
  const content: string = req.body?.content ?? "";
  if (!content.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const exists = db.get().memories.some((m) => m.id === id);
  if (!exists) {
    res.status(404).json({ error: "memory not found" });
    return;
  }

  const updated = await updateMemoryContent(id, content);
  res.json(toClientMemory(updated!));
});

memoriesRouter.delete("/:id", (req, res) => {
  const { id } = req.params;
  const existed = db.mutate((s) => {
    const before = s.memories.length;
    s.memories = s.memories.filter((m) => m.id !== id);
    return s.memories.length < before;
  });

  if (!existed) {
    res.status(404).json({ error: "memory not found" });
    return;
  }
  res.status(204).send();
});
