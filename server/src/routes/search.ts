import { Router } from "express";
import { db } from "../db.js";

export const searchRouter = Router();

searchRouter.get("/", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  if (!q) {
    res.json([]);
    return;
  }

  const { messages, conversations, personas } = db.get();
  const conversationById = new Map(conversations.map((c) => [c.id, c]));
  const personaById = new Map(personas.map((p) => [p.id, p]));

  const results = messages
    .filter((m) => m.content.toLowerCase().includes(q))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 100)
    .map((message) => {
      const conversation = conversationById.get(message.conversationId);
      const persona = conversation ? personaById.get(conversation.personaId) : undefined;
      return {
        message,
        personaId: persona?.id ?? "",
        personaName: persona?.name ?? "Unknown",
        conversationId: conversation?.id ?? "",
        conversationTitle: conversation?.title ?? "Unknown",
      };
    })
    .filter((r) => r.conversationId && r.personaId);

  res.json(results);
});
