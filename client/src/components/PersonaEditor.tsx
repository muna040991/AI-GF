import { useEffect, useState } from "react";
import { api, type OllamaModel, type Persona } from "../api.js";
import { getVoices, isSpeechSynthesisSupported } from "../tts.js";

interface Props {
  persona: Persona | null;
  availableModels: OllamaModel[];
  onCancel: () => void;
  onSave: (data: Omit<Persona, "id" | "createdAt">) => void | Promise<void>;
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
  const [styleReferenceImage, setStyleReferenceImage] = useState(persona?.styleReferenceImage ?? "");
  const [temperature, setTemperature] = useState(persona?.temperature?.toString() ?? "");
  const [maxTokens, setMaxTokens] = useState(persona?.maxTokens?.toString() ?? "");
  const [galleryImages, setGalleryImages] = useState<string[]>(persona?.galleryImages ?? []);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  function handleStyleReferenceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setStyleReferenceImage(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("Could not read file."));
      };
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
    });
  }

  async function handleGalleryFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || !persona) return;

    setGalleryError(null);
    setGalleryUploading(true);
    try {
      for (const file of files) {
        const dataUrl = await readAsDataUrl(file);
        const updated = await api.addGalleryImage(persona.id, dataUrl);
        setGalleryImages(updated);
      }
    } catch (err) {
      setGalleryError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setGalleryUploading(false);
    }
  }

  async function handleDeleteGalleryImage(index: number) {
    if (!persona) return;
    try {
      const updated = await api.deleteGalleryImage(persona.id, index);
      setGalleryImages(updated);
    } catch (err) {
      setGalleryError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Give this character a name.");
      return;
    }
    if (!systemPrompt.trim()) {
      setFormError("Persona / system prompt can't be empty.");
      return;
    }
    if (!model.trim()) {
      setFormError(
        availableModels.length === 0
          ? "Type the exact name of a model you've pulled in Ollama (e.g. dolphin-mistral). The model list couldn't be loaded — is Ollama running?"
          : "Pick a model."
      );
      return;
    }
    setFormError(null);
    try {
      await onSave({
        name: name.trim(),
        systemPrompt: systemPrompt.trim(),
        model,
        avatarColor,
        voiceURI: voiceURI || undefined,
        avatarImage: avatarImage || undefined,
        appearance: appearance.trim() || undefined,
        styleReferenceImage: styleReferenceImage || undefined,
        temperature: temperature.trim() ? Number(temperature) : undefined,
        maxTokens: maxTokens.trim() ? Number(maxTokens) : undefined,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save this character.");
    }
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
            Temperature (0-2, blank = model's own default)
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              placeholder="e.g. 0.8"
            />
          </label>
          <label>
            Max reply length (tokens, blank = model's own default)
            <input
              type="number"
              min="1"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              placeholder="e.g. 200"
            />
          </label>
        </div>
        <span className="hint">
          Leaving these blank uses whatever the model file itself defaults to, which varies a lot between
          models and can produce rambling or erratic replies. If replies feel incoherent or run on too long,
          try setting temperature around 0.7-0.9 and max reply length around 150-250.
        </span>

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
          Style reference image (optional)
          <div className="avatar-upload-row">
            {styleReferenceImage ? (
              <img src={styleReferenceImage} alt="" className="avatar-img" />
            ) : (
              <span className="avatar-dot" style={{ background: "var(--panel-2)" }} />
            )}
            <input type="file" accept="image/*" onChange={handleStyleReferenceFile} />
            {styleReferenceImage && (
              <button type="button" onClick={() => setStyleReferenceImage("")}>
                Remove
              </button>
            )}
          </div>
          <span className="hint">
            Nudges generated selfies toward this image's general color palette and vibe. This is loose
            stylistic continuity, not a precise face match — this app doesn't do identity-locked
            photorealistic generation.
          </span>
        </label>

        {persona && (
          <label>
            Photo gallery
            <div className="gallery-grid">
              {galleryImages.map((img, i) => (
                <div key={i} className="gallery-thumb">
                  <img src={img} alt="" />
                  <div className="gallery-thumb-actions">
                    <button
                      type="button"
                      onClick={() => setStyleReferenceImage(img)}
                      title="Use as style reference"
                    >
                      ★
                    </button>
                    <button type="button" onClick={() => handleDeleteGalleryImage(i)} title="Delete">
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <input type="file" accept="image/*" multiple onChange={handleGalleryFiles} disabled={galleryUploading} />
            {galleryUploading && <span className="hint">Uploading…</span>}
            {galleryError && <span className="hint">{galleryError}</span>}
            <span className="hint">
              Store reference photos here, then tap ★ on one to use it as the style reference above. Same
              loose-style behavior — not identity-locked generation.
            </span>
          </label>
        )}

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

        {formError && <p className="hint form-error">{formError}</p>}

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
