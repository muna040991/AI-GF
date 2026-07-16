import type { Persona } from "./types.js";

type SeedPersona = Omit<Persona, "id" | "createdAt">;

export class CharacterCardError extends Error {}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Exports in the widely-used "Character Card V2" JSON shape (SillyTavern /
 * Character.AI style), so cards can be shared with other tools. Our own
 * extra fields ride along in data.extensions.aigf for full round-trip
 * fidelity when re-imported here.
 */
export function exportPersonaAsCard(persona: Persona) {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: persona.name,
      description: "",
      personality: "",
      scenario: "",
      first_mes: "",
      mes_example: "",
      creator_notes: "Exported from AI-GF.",
      system_prompt: persona.systemPrompt,
      post_history_instructions: "",
      alternate_greetings: [] as string[],
      tags: [] as string[],
      creator: "",
      character_version: "1.0",
      extensions: {
        aigf: {
          model: persona.model,
          avatarColor: persona.avatarColor,
          voiceURI: persona.voiceURI,
          avatarImage: persona.avatarImage,
          temperature: persona.temperature,
          maxTokens: persona.maxTokens,
          appearance: persona.appearance,
        },
      },
    },
  };
}

/**
 * Imports either our own exported cards or third-party V1/V2 character
 * cards. Prefers system_prompt when present; otherwise falls back to
 * combining description/personality/scenario, which is how most
 * non-AI-GF cards carry a character definition.
 */
export function importCharacterCard(raw: unknown): SeedPersona {
  if (!isRecord(raw)) throw new CharacterCardError("Not a valid character card file.");

  const data = isRecord(raw.data) ? raw.data : raw;
  const name = data.name;
  if (typeof name !== "string" || !name.trim()) {
    throw new CharacterCardError("Card is missing a character name.");
  }

  const extensions = isRecord(data.extensions) ? data.extensions : {};
  const aigf = isRecord(extensions.aigf) ? extensions.aigf : {};

  let systemPrompt = typeof data.system_prompt === "string" ? data.system_prompt.trim() : "";
  if (!systemPrompt) {
    const parts = [data.description, data.personality, data.scenario].filter(
      (p): p is string => typeof p === "string" && p.trim().length > 0
    );
    systemPrompt = parts.join("\n\n");
    if (typeof data.first_mes === "string" && data.first_mes.trim()) {
      systemPrompt += `\n\nYour usual opening line is something like: "${data.first_mes.trim()}"`;
    }
  }
  if (!systemPrompt) {
    throw new CharacterCardError("Card has no system prompt, description, or personality to import.");
  }

  return {
    name: name.trim(),
    systemPrompt,
    model: typeof aigf.model === "string" ? aigf.model : "dolphin-mistral",
    avatarColor: typeof aigf.avatarColor === "string" ? aigf.avatarColor : "#8b5cf6",
    voiceURI: typeof aigf.voiceURI === "string" ? aigf.voiceURI : undefined,
    avatarImage: typeof aigf.avatarImage === "string" ? aigf.avatarImage : undefined,
    temperature: typeof aigf.temperature === "number" ? aigf.temperature : undefined,
    maxTokens: typeof aigf.maxTokens === "number" ? aigf.maxTokens : undefined,
    appearance: typeof aigf.appearance === "string" ? aigf.appearance : undefined,
  };
}
