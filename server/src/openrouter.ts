// Thin client for OpenRouter's cloud API (https://openrouter.ai) — an
// OpenAI-compatible aggregator giving access to many models, including
// free-tier and community "uncensored" fine-tunes, behind one API key.
//
// Unlike every other client in this codebase, this one is NOT local-only:
// choosing this provider for a character explicitly opts that character's
// chat out of the app's offline guarantee. It's per-character and requires
// deliberately setting OPENROUTER_API_KEY — nothing is sent here by default.

import type { ChatMessage, GenerationOptions } from "./ollama.js";

const OPENROUTER_HOST = process.env.OPENROUTER_HOST ?? "https://openrouter.ai/api/v1";

export class OpenRouterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterError";
  }
}

function requireApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new OpenRouterError(
      "No OPENROUTER_API_KEY is set. Add one to a .env file in the project root (see .env.example) to use an online-provider character."
    );
  }
  return key;
}

/**
 * Streams a chat completion from OpenRouter's OpenAI-compatible endpoint.
 * Mirrors ollama.ts's chatStream signature so callers can treat both
 * providers interchangeably.
 */
export async function chatStream(
  model: string,
  messages: ChatMessage[],
  onToken: (chunk: string) => void,
  options?: GenerationOptions
): Promise<string> {
  const apiKey = requireApiKey();

  // OpenRouter (like most hosted providers) doesn't accept Ollama's simple
  // { images: [...] } shape — vision input isn't supported for
  // OpenRouter-backed characters in this app yet, so strip it rather than
  // sending a request the API will reject.
  const openRouterMessages = messages.map(({ role, content }) => ({ role, content }));

  let res: Response;
  try {
    res = await fetch(`${OPENROUTER_HOST}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: openRouterMessages,
        stream: true,
        ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options?.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
      }),
    });
  } catch {
    throw new OpenRouterError(`Could not reach OpenRouter at ${OPENROUTER_HOST}. Check your internet connection.`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new OpenRouterError(`OpenRouter request failed (${res.status}): ${body}`);
  }
  if (!res.body) throw new OpenRouterError("OpenRouter returned no response body");

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
      if (!line.startsWith("data:")) continue;

      const data = line.slice("data:".length).trim();
      if (data === "[DONE]") continue;

      let parsed: { choices?: Array<{ delta?: { content?: string } }> };
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      const piece = parsed.choices?.[0]?.delta?.content ?? "";
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
