// Routes chat generation to whichever provider a persona is configured for.
// Everything else in the app (routes, memory extraction) goes through here
// instead of importing ollama.ts/openrouter.ts directly, so provider choice
// stays a one-line branch instead of scattered conditionals.

import { chatStream as ollamaChatStream, type ChatMessage, type GenerationOptions, OllamaError } from "./ollama.js";
import { chatStream as openRouterChatStream, OpenRouterError } from "./openrouter.js";
import type { Persona } from "./types.js";

export { OllamaError, OpenRouterError };

/** True if the error came from either provider client (as opposed to a bug elsewhere). */
export function isProviderError(err: unknown): err is OllamaError | OpenRouterError {
  return err instanceof OllamaError || err instanceof OpenRouterError;
}

export async function chatStreamForPersona(
  persona: Pick<Persona, "provider" | "model">,
  messages: ChatMessage[],
  onToken: (chunk: string) => void,
  options?: GenerationOptions
): Promise<string> {
  if (persona.provider === "openrouter") {
    return openRouterChatStream(persona.model, messages, onToken, options);
  }
  return ollamaChatStream(persona.model, messages, onToken, options);
}
