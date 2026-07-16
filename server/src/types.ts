export interface Persona {
  id: string;
  name: string;
  systemPrompt: string;
  /**
   * Which backend runs this character's chat. "ollama" (default, also used
   * when unset) talks to your local Ollama daemon — nothing leaves your
   * machine. "openrouter" sends chat requests to OpenRouter's cloud API
   * instead, using the server's OPENROUTER_API_KEY env var; this is an
   * explicit opt-out of the app's local-only guarantee, per-character.
   */
  provider?: "ollama" | "openrouter";
  /** Model identifier — an Ollama tag (e.g. "dolphin-mistral") or, for provider "openrouter", an OpenRouter model id (e.g. "cognitivecomputations/dolphin-mixtral-8x7b"). */
  model: string;
  avatarColor: string;
  /** Browser SpeechSynthesisVoice.voiceURI used for this persona's spoken replies, if set. */
  voiceURI?: string;
  /** Data-URI image shown in place of the color dot, if set. */
  avatarImage?: string;
  /** Ollama generation temperature (0-2). Unset = model default. */
  temperature?: number;
  /** Maps to Ollama's num_predict. Unset = model default. */
  maxTokens?: number;
  /** Short visual description used as the base prompt for AI-generated selfies. */
  appearance?: string;
  /**
   * Optional reference image used for loose stylistic continuity (color
   * palette, outfit/art-style vibe) across generated selfies via img2img.
   * This is NOT identity/face-locking — it doesn't attempt to reproduce a
   * specific face precisely, by design.
   */
  styleReferenceImage?: string;
  /** A stored library of reference photos for this character; any one can be promoted to styleReferenceImage. */
  galleryImages?: string[];
  createdAt: number;
}

export interface Conversation {
  id: string;
  personaId: string;
  title: string;
  createdAt: number;
}

export type Role = "user" | "assistant";

export interface Message {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  /** Alternate regenerated replies for this message slot. If present, content mirrors variants[activeVariantIndex]. */
  variants?: string[];
  activeVariantIndex?: number;
  pinned?: boolean;
  /** Data-URI images attached to (user, vision input) or generated for (assistant, selfies) this message. */
  images?: string[];
  /** Data-URI (video/mp4) generated for this message, if it's an animated selfie. */
  video?: string;
  createdAt: number;
}

export interface Memory {
  id: string;
  personaId: string;
  content: string;
  embedding: number[];
  createdAt: number;
}

export interface StoreShape {
  personas: Persona[];
  conversations: Conversation[];
  messages: Message[];
  memories: Memory[];
  /** Names of built-in starter personas ever seeded, so deleted ones don't reappear. */
  seededPersonaNames: string[];
}
