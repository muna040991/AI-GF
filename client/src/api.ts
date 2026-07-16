export interface Persona {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  avatarColor: string;
  voiceURI?: string;
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
  createdAt: number;
}

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
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

  transcribe: async (blob: Blob): Promise<string> => {
    const res = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": blob.type || "audio/webm" },
      body: blob,
    });
    const data = await json<{ text: string }>(res);
    return data.text;
  },
};

interface StreamHandlers {
  onToken: (chunk: string) => void;
  onDone: (message: Message) => void;
  onError: (message: string) => void;
}

/**
 * Posts a user message and streams the assistant's Server-Sent Events
 * reply, invoking the matching handler as each event arrives.
 */
export async function sendMessageStream(
  conversationId: string,
  content: string,
  handlers: StreamHandlers
): Promise<void> {
  const res = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

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
    }
  }
}
