import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db.js";
import { chatStream, OllamaError, type ChatMessage } from "../ollama.js";
import { maybeExtractMemory, retrieveRelevantMemories } from "../memory.js";
import type { Conversation, Message } from "../types.js";

export const conversationsRouter = Router();

const HISTORY_WINDOW = 20;

conversationsRouter.get("/persona/:personaId", (req, res) => {
  const { personaId } = req.params;
  const conversations = db
    .get()
    .conversations.filter((c) => c.personaId === personaId)
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json(conversations);
});

conversationsRouter.post("/persona/:personaId", (req, res) => {
  const { personaId } = req.params;
  const persona = db.get().personas.find((p) => p.id === personaId);
  if (!persona) {
    res.status(404).json({ error: "persona not found" });
    return;
  }

  const conversation: Conversation = {
    id: nanoid(),
    personaId,
    title: req.body?.title || "New conversation",
    createdAt: Date.now(),
  };
  db.mutate((s) => s.conversations.push(conversation));
  res.status(201).json(conversation);
});

conversationsRouter.delete("/:id", (req, res) => {
  const { id } = req.params;
  db.mutate((s) => {
    s.conversations = s.conversations.filter((c) => c.id !== id);
    s.messages = s.messages.filter((m) => m.conversationId !== id);
  });
  res.status(204).send();
});

conversationsRouter.get("/:id/messages", (req, res) => {
  const { id } = req.params;
  const messages = db
    .get()
    .messages.filter((m) => m.conversationId === id)
    .sort((a, b) => a.createdAt - b.createdAt);
  res.json(messages);
});

// Streams the assistant's reply back as Server-Sent Events so the UI can
// render tokens as they arrive from the local Ollama daemon.
conversationsRouter.post("/:id/messages", async (req, res) => {
  const { id } = req.params;
  const content: string = req.body?.content ?? "";
  if (!content.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const conversation = db.get().conversations.find((c) => c.id === id);
  if (!conversation) {
    res.status(404).json({ error: "conversation not found" });
    return;
  }
  const persona = db.get().personas.find((p) => p.id === conversation.personaId);
  if (!persona) {
    res.status(404).json({ error: "persona not found" });
    return;
  }

  const userMessage: Message = {
    id: nanoid(),
    conversationId: id,
    role: "user",
    content,
    createdAt: Date.now(),
  };
  db.mutate((s) => s.messages.push(userMessage));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const history = db
      .get()
      .messages.filter((m) => m.conversationId === id)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-HISTORY_WINDOW);

    const relevantMemories = await retrieveRelevantMemories(persona.id, content);
    const today = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date());
    let systemPrompt = `${persona.systemPrompt}\n\nToday's date is ${today}.`;
    if (relevantMemories.length > 0) {
      systemPrompt +=
        "\n\nThings you remember about this user from past conversations:\n" +
        relevantMemories.map((m) => `- ${m.content}`).join("\n");
    }

    const chatMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    ];

    const fullReply = await chatStream(persona.model, chatMessages, (chunk) => {
      send("token", { chunk });
    });

    const assistantMessage: Message = {
      id: nanoid(),
      conversationId: id,
      role: "assistant",
      content: fullReply,
      createdAt: Date.now(),
    };
    db.mutate((s) => s.messages.push(assistantMessage));

    send("done", { message: assistantMessage });
    res.end();

    void maybeExtractMemory(
      persona.id,
      persona.model,
      history.map((m) => ({ role: m.role, content: m.content }) as ChatMessage)
    );
  } catch (err) {
    const message = err instanceof OllamaError ? err.message : "Unexpected error talking to the model.";
    send("error", { message });
    res.end();
  }
});
