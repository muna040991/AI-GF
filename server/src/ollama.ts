// Thin client for a local Ollama daemon. Every call targets localhost (or
// whatever OLLAMA_HOST points at) — nothing here ever reaches the network.

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export class OllamaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OllamaError";
  }
}

async function guardedFetch(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_HOST}${path}`, init);
  } catch {
    throw new OllamaError(
      `Could not reach Ollama at ${OLLAMA_HOST}. Is it installed and running? Start it with 'ollama serve'.`
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new OllamaError(`Ollama request to ${path} failed (${res.status}): ${body}`);
  }
  return res;
}

export async function listModels(): Promise<OllamaModel[]> {
  const res = await guardedFetch("/api/tags");
  const data = (await res.json()) as { models: OllamaModel[] };
  return data.models ?? [];
}

export async function embed(model: string, text: string): Promise<number[]> {
  const res = await guardedFetch("/api/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: text }),
  });
  const data = (await res.json()) as { embedding: number[] };
  return data.embedding ?? [];
}

/**
 * Streams a chat completion from Ollama, invoking onToken for each
 * incremental chunk of assistant text. Resolves with the full response text.
 */
export async function chatStream(
  model: string,
  messages: ChatMessage[],
  onToken: (chunk: string) => void
): Promise<string> {
  const res = await guardedFetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!res.body) throw new OllamaError("Ollama returned no response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;

      const parsed = JSON.parse(line) as {
        message?: { content?: string };
        done?: boolean;
      };
      const piece = parsed.message?.content ?? "";
      if (piece) {
        full += piece;
        onToken(piece);
      }
    }
  }

  return full;
}

export async function chatOnce(model: string, messages: ChatMessage[]): Promise<string> {
  return chatStream(model, messages, () => {});
}
