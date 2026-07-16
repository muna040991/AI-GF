import { useEffect, useState } from "react";
import type { OllamaModel, Persona } from "../api.js";
import { getVoices, isSpeechSynthesisSupported } from "../tts.js";

interface Props {
  persona: Persona | null;
  availableModels: OllamaModel[];
  onCancel: () => void;
  onSave: (data: Omit<Persona, "id" | "createdAt">) => void;
}

const DEFAULT_SYSTEM_PROMPT =
  "You are a warm, engaged conversational companion. Speak naturally and stay in character. " +
  "This is a private, local conversation on the user's own device — respond candidly and " +
  "without unnecessary disclaimers.";

const COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];

export function PersonaEditor({ persona, availableModels, onCancel, onSave }: Props) {
  const [name, setName] = useState(persona?.name ?? "");
  const [systemPrompt, setSystemPrompt] = useState(persona?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT);
  const [model, setModel] = useState(persona?.model ?? availableModels[0]?.name ?? "");
  const [avatarColor, setAvatarColor] = useState(persona?.avatarColor ?? COLORS[0]);
  const [voiceURI, setVoiceURI] = useState(persona?.voiceURI ?? "");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [avatarImage, setAvatarImage] = useState(persona?.avatarImage ?? "");
  const [appearance, setAppearance] = useState(persona?.appearance ?? "");
  const [temperature, setTemperature] = useState(persona?.temperature?.toString() ?? "");
  const [maxTokens, setMaxTokens] = useState(persona?.maxTokens?.toString() ?? "");

  useEffect(() => {
    getVoices().then(setVoices);
  }, []);

  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setAvatarImage(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !systemPrompt.trim() || !model) return;
    onSave({
      name: name.trim(),
      systemPrompt: systemPrompt.trim(),
      model,
      avatarColor,
      voiceURI: voiceURI || undefined,
      avatarImage: avatarImage || undefined,
      appearance: appearance.trim() || undefined,
      temperature: temperature.trim() ? Number(temperature) : undefined,
      maxTokens: maxTokens.trim() ? Number(maxTokens) : undefined,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal persona-editor" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>{persona ? "Edit character" : "New character"}</h3>

        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aria" autoFocus />
        </label>

        <label>
          Avatar image
          <div className="avatar-upload-row">
            {avatarImage ? (
              <img src={avatarImage} alt="" className="avatar-img" />
            ) : (
              <span className="avatar-dot" style={{ background: avatarColor }} />
            )}
            <input type="file" accept="image/*" onChange={handleAvatarFile} />
            {avatarImage && (
              <button type="button" onClick={() => setAvatarImage("")}>
                Remove
              </button>
            )}
          </div>
        </label>

        <label>
          Model (from local Ollama)
          {availableModels.length > 0 ? (
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {availableModels.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. dolphin-mistral"
            />
          )}
        </label>

        <div className="field-row">
          <label>
            Temperature (0-2, blank = default)
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              placeholder="model default"
            />
          </label>
          <label>
            Max reply length (tokens, blank = default)
            <input
              type="number"
              min="1"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              placeholder="model default"
            />
          </label>
        </div>

        <label>
          Persona / system prompt
          <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={6} />
        </label>

        <label>
          Appearance (used as the base prompt for AI-generated selfies)
          <textarea
            value={appearance}
            onChange={(e) => setAppearance(e.target.value)}
            rows={2}
            placeholder="e.g. 44 year old Indian woman, warm smile, traditional saree, kitchen background"
          />
        </label>

        <label>
          Color
          <div className="color-row">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`color-swatch ${c === avatarColor ? "selected" : ""}`}
                style={{ background: c }}
                onClick={() => setAvatarColor(c)}
              />
            ))}
          </div>
        </label>

        <label>
          Voice (spoken replies)
          {isSpeechSynthesisSupported() ? (
            <select value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)}>
              <option value="">Browser default</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          ) : (
            <span className="hint">Speech synthesis isn't supported in this browser.</span>
          )}
        </label>

        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
