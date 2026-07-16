export interface Persona {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  avatarColor: string;
  voiceURI?: string;
  avatarImage?: string;
  temperature?: number;
  maxTokens?: number;
  appearance?: string;
  styleReferenceImage?: string;
  galleryImages?: string[];
  createdAt: number;
}

export interface Conversation {
  id: string;
  personaId: string;
  title: string;
  createdAt: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  variants?: string[];
  activeVariantIndex?: number;
  pinned?: boolean;
  images?: string[];
  video?: string;
  createdAt: number;
}

export interface Memory {
  id: string;
  personaId: string;
  content: string;
  createdAt: number;
}

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export interface SearchResult {
  message: Message;
  personaId: string;
  personaName: string;
  conversationId: string;
  conversationTitle: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listModels: () => fetch("/api/models").then((r) => json<OllamaModel[]>(r)),

  listPersonas: () => fetch("/api/personas").then((r) => json<Persona[]>(r)),
  createPersona: (data: Omit<Persona, "id" | "createdAt">) =>
    fetch("/api/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => json<Persona>(r)),
  updatePersona: (id: string, data: Partial<Omit<Persona, "id" | "createdAt">>) =>
    fetch(`/api/personas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => json<Persona>(r)),
  deletePersona: (id: string) => fetch(`/api/personas/${id}`, { method: "DELETE" }),
  exportPersona: (id: string) => fetch(`/api/personas/${id}/export`).then((r) => json<unknown>(r)),

  addGalleryImage: (personaId: string, image: string) =>
    fetch(`/api/personas/${personaId}/gallery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    }).then((r) => json<string[]>(r)),
  deleteGalleryImage: (personaId: string, index: number) =>
    fetch(`/api/personas/${personaId}/gallery/${index}`, { method: "DELETE" }).then((r) => json<string[]>(r)),
  importPersona: (card: unknown) =>
    fetch("/api/personas/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    }).then((r) => json<Persona>(r)),

  listConversations: (personaId: string) =>
    fetch(`/api/conversations/persona/${personaId}`).then((r) => json<Conversation[]>(r)),
  createConversation: (personaId: string, title: string) =>
    fetch(`/api/conversations/persona/${personaId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).then((r) => json<Conversation>(r)),
  deleteConversation: (id: string) => fetch(`/api/conversations/${id}`, { method: "DELETE" }),

  listMessages: (conversationId: string) =>
    fetch(`/api/conversations/${conversationId}/messages`).then((r) => json<Message[]>(r)),
  editMessage: (conversationId: string, messageId: string, content: string) =>
    fetch(`/api/conversations/${conversationId}/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }).then((r) => json<Message>(r)),
  deleteMessage: (conversationId: string, messageId: string) =>
    fetch(`/api/conversations/${conversationId}/messages/${messageId}`, { method: "DELETE" }),
  swipeMessage: (conversationId: string, messageId: string, direction: "prev" | "next") =>
    fetch(`/api/conversations/${conversationId}/messages/${messageId}/swipe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    }).then((r) => json<Message>(r)),
  togglePin: (conversationId: string, messageId: string) =>
    fetch(`/api/conversations/${conversationId}/messages/${messageId}/pin`, {
      method: "PATCH",
    }).then((r) => json<Message>(r)),

  generateImage: (conversationId: string, prompt: string) =>
    fetch(`/api/conversations/${conversationId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    }).then((r) => json<Message>(r)),

  generateVideo: (conversationId: string, motionPrompt: string, image?: string) =>
    fetch(`/api/conversations/${conversationId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motionPrompt, image }),
    }).then((r) => json<Message>(r)),

  search: (q: string) =>
    fetch(`/api/search?q=${encodeURIComponent(q)}`).then((r) => json<SearchResult[]>(r)),

  listMemories: (personaId: string) =>
    fetch(`/api/personas/${personaId}/memories`).then((r) => json<Memory[]>(r)),
  addMemory: (personaId: string, content: string) =>
    fetch(`/api/personas/${personaId}/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }).then((r) => json<Memory>(r)),
  editMemory: (id: string, content: string) =>
    fetch(`/api/memories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }).then((r) => json<Memory>(r)),
  deleteMemory: (id: string) => fetch(`/api/memories/${id}`, { method: "DELETE" }),

  transcribe: async (blob: Blob): Promise<string> => {
    const res = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": blob.type || "audio/webm" },
      body: blob,
    });
    const data = await json<{ text: string }>(res);
    return data.text;
  },

  exportBackup: (passphrase: string) =>
    fetch("/api/backup/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase }),
    }).then((r) => json<unknown>(r)),
  importBackup: (passphrase: string, envelope: unknown) =>
    fetch("/api/backup/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase, envelope }),
    }).then((r) => json<{ ok: true }>(r)),
};

interface StreamHandlers {
  onToken: (chunk: string) => void;
  onDone: (message: Message) => void;
  onError: (message: string) => void;
  /** Fires once the user's own message is durably saved, with its real server-assigned id. */
  onUserSaved?: (message: Message) => void;
}

async function readSseStream(res: Response, handlers: StreamHandlers): Promise<void> {
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    handlers.onError(body.error ?? "Request failed");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const eventLine = rawEvent.split("\n").find((l) => l.startsWith("event:"));
      const dataLine = rawEvent.split("\n").find((l) => l.startsWith("data:"));
      if (!eventLine || !dataLine) continue;

      const event = eventLine.replace("event:", "").trim();
      const data = JSON.parse(dataLine.replace("data:", "").trim());

      if (event === "token") handlers.onToken(data.chunk);
      else if (event === "done") handlers.onDone(data.message);
      else if (event === "error") handlers.onError(data.message);
      else if (event === "user_saved") handlers.onUserSaved?.(data.message);
    }
  }
}

/**
 * Posts a user message (optionally with attached images for vision-capable
 * models) and streams the assistant's Server-Sent Events reply.
 */
export async function sendMessageStream(
  conversationId: string,
  content: string,
  handlers: StreamHandlers,
  images?: string[]
): Promise<void> {
  try {
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, images }),
    });
    await readSseStream(res, handlers);
  } catch {
    handlers.onError("Could not reach the app's server. Is it still running?");
  }
}

/** Regenerates the most recent assistant message, streaming the new variant. */
export async function regenerateMessageStream(
  conversationId: string,
  messageId: string,
  handlers: StreamHandlers
): Promise<void> {
  try {
    const res = await fetch(`/api/conversations/${conversationId}/messages/${messageId}/regenerate`, {
      method: "POST",
    });
    await readSseStream(res, handlers);
  } catch {
    handlers.onError("Could not reach the app's server. Is it still running?");
  }
}
