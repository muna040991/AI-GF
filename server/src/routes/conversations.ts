import { Router, type Response } from "express";
import { nanoid } from "nanoid";
import { db } from "../db.js";
import { chatStream, OllamaError, toRawBase64, type ChatMessage } from "../ollama.js";
import { maybeExtractMemory, retrieveRelevantMemories } from "../memory.js";
import { generateImage, StableDiffusionError } from "../stableDiffusion.js";
import type { Conversation, Message, Persona } from "../types.js";

export const conversationsRouter = Router();

const HISTORY_WINDOW = 20;

function sortedMessages(conversationId: string): Message[] {
  return db
    .get()
    .messages.filter((m) => m.conversationId === conversationId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

function toChatMessage(m: Message): ChatMessage {
  return {
    role: m.role,
    content: m.content,
    ...(m.images && m.images.length > 0 ? { images: m.images.map(toRawBase64) } : {}),
  };
}

async function buildSystemPrompt(persona: Persona, latestUserContent: string): Promise<string> {
  const relevantMemories = await retrieveRelevantMemories(persona.id, latestUserContent);
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
  return systemPrompt;
}

function openSse(res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  return (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}

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
  res.json(sortedMessages(req.params.id));
});

conversationsRouter.patch("/:id/messages/:messageId", (req, res) => {
  const { messageId } = req.params;
  const content: string = req.body?.content ?? "";
  if (!content.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const updated = db.mutate((s) => {
    const msg = s.messages.find((m) => m.id === messageId);
    if (!msg) return null;
    msg.content = content;
    if (msg.variants && msg.activeVariantIndex !== undefined) {
      msg.variants[msg.activeVariantIndex] = content;
    }
    return msg;
  });

  if (!updated) {
    res.status(404).json({ error: "message not found" });
    return;
  }
  res.json(updated);
});

conversationsRouter.delete("/:id/messages/:messageId", (req, res) => {
  const { messageId } = req.params;
  const existed = db.mutate((s) => {
    const before = s.messages.length;
    s.messages = s.messages.filter((m) => m.id !== messageId);
    return s.messages.length < before;
  });

  if (!existed) {
    res.status(404).json({ error: "message not found" });
    return;
  }
  res.status(204).send();
});

conversationsRouter.patch("/:id/messages/:messageId/pin", (req, res) => {
  const { messageId } = req.params;
  const updated = db.mutate((s) => {
    const msg = s.messages.find((m) => m.id === messageId);
    if (!msg) return null;
    msg.pinned = !msg.pinned;
    return msg;
  });

  if (!updated) {
    res.status(404).json({ error: "message not found" });
    return;
  }
  res.json(updated);
});

conversationsRouter.post("/:id/messages/:messageId/swipe", (req, res) => {
  const { messageId } = req.params;
  const direction: "prev" | "next" = req.body?.direction === "prev" ? "prev" : "next";

  const updated = db.mutate((s) => {
    const msg = s.messages.find((m) => m.id === messageId);
    if (!msg || !msg.variants || msg.variants.length < 2) return null;
    const current = msg.activeVariantIndex ?? msg.variants.length - 1;
    const next = direction === "next" ? Math.min(current + 1, msg.variants.length - 1) : Math.max(current - 1, 0);
    msg.activeVariantIndex = next;
    msg.content = msg.variants[next];
    return msg;
  });

  if (!updated) {
    res.status(400).json({ error: "message has no alternate variants to swipe through" });
    return;
  }
  res.json(updated);
});

// Generates a character selfie via a local Stable Diffusion server and
// saves it as an assistant message. Not streamed — image generation
// doesn't produce incremental tokens, so this is a plain JSON response.
conversationsRouter.post("/:id/images", async (req, res) => {
  const { id } = req.params;
  const prompt: string = req.body?.prompt ?? "";

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

  const fullPrompt = [persona.appearance, prompt].filter((p) => p && p.trim()).join(", ");
  if (!fullPrompt.trim()) {
    res.status(400).json({
      error: "Add a description of what to generate, or set the character's appearance in the persona editor.",
    });
    return;
  }

  try {
    const image = await generateImage(fullPrompt);
    const message: Message = {
      id: nanoid(),
      conversationId: id,
      role: "assistant",
      content: prompt.trim() ? `*sends a photo* ${prompt.trim()}` : "*sends a photo*",
      images: [image],
      createdAt: Date.now(),
    };
    db.mutate((s) => s.messages.push(message));
    res.status(201).json(message);
  } catch (err) {
    const message = err instanceof StableDiffusionError ? err.message : "Image generation failed.";
    res.status(503).json({ error: message });
  }
});

// Streams the assistant's reply back as Server-Sent Events so the UI can
// render tokens as they arrive from the local Ollama daemon.
conversationsRouter.post("/:id/messages", async (req, res) => {
  const { id } = req.params;
  const content: string = req.body?.content ?? "";
  const images: string[] | undefined = Array.isArray(req.body?.images) ? req.body.images : undefined;
  if (!content.trim() && (!images || images.length === 0)) {
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
    ...(images && images.length > 0 ? { images } : {}),
    createdAt: Date.now(),
  };
  db.mutate((s) => s.messages.push(userMessage));

  const send = openSse(res);
  send("user_saved", { message: userMessage });

  try {
    const history = sortedMessages(id).slice(-HISTORY_WINDOW);
    const systemPrompt = await buildSystemPrompt(persona, content);

    const chatMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.map(toChatMessage),
    ];

    const fullReply = await chatStream(
      persona.model,
      chatMessages,
      (chunk) => send("token", { chunk }),
      { temperature: persona.temperature, maxTokens: persona.maxTokens }
    );

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

// Regenerates the most recent assistant reply in place, adding it as a new
// swipeable variant rather than replacing history.
conversationsRouter.post("/:id/messages/:messageId/regenerate", async (req, res) => {
  const { id, messageId } = req.params;

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

  const allMessages = sortedMessages(id);
  const target = allMessages.find((m) => m.id === messageId);
  const isLatest = allMessages[allMessages.length - 1]?.id === messageId;
  if (!target || target.role !== "assistant" || !isLatest) {
    res.status(400).json({ error: "can only regenerate the most recent assistant reply" });
    return;
  }

  const historyBefore = allMessages.filter((m) => m.id !== messageId).slice(-HISTORY_WINDOW);
  const lastUserMessage = [...historyBefore].reverse().find((m) => m.role === "user");

  const send = openSse(res);

  try {
    const systemPrompt = await buildSystemPrompt(persona, lastUserMessage?.content ?? "");
    const chatMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...historyBefore.map(toChatMessage),
    ];

    const fullReply = await chatStream(
      persona.model,
      chatMessages,
      (chunk) => send("token", { chunk }),
      { temperature: persona.temperature, maxTokens: persona.maxTokens }
    );

    const updated = db.mutate((s) => {
      const msg = s.messages.find((m) => m.id === messageId);
      if (!msg) return null;
      const variants = msg.variants && msg.variants.length > 0 ? msg.variants : [msg.content];
      variants.push(fullReply);
      msg.variants = variants;
      msg.activeVariantIndex = variants.length - 1;
      msg.content = fullReply;
      return msg;
    });

    send("done", { message: updated });
    res.end();
  } catch (err) {
    const message = err instanceof OllamaError ? err.message : "Unexpected error talking to the model.";
    send("error", { message });
    res.end();
  }
});
