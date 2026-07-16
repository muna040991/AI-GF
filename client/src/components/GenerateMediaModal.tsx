import { useState } from "react";
import type { Persona } from "../api.js";

const MOTION_TEMPLATES = [
  { label: "None", keywords: "" },
  { label: "Cinematic Zoom", keywords: "slow cinematic zoom in, smooth camera motion" },
  { label: "Slow Pan", keywords: "slow horizontal pan, gentle camera movement" },
  { label: "Dramatic Reveal", keywords: "dramatic reveal, slow motion, particles" },
  { label: "Gentle Sway", keywords: "gentle idle sway, subtle breathing motion, hair movement" },
];

interface PhotoProps {
  kind: "photo";
  persona: Persona;
  busy: boolean;
  onCancel: () => void;
  onGenerate: (details: string) => void;
}

interface VideoProps {
  kind: "video";
  persona: Persona;
  busy: boolean;
  onCancel: () => void;
  onGenerate: (motionPrompt: string) => void;
}

export function GenerateMediaModal(props: PhotoProps | VideoProps) {
  const { kind, persona, busy, onCancel } = props;
  const [details, setDetails] = useState("");
  const [templateIndex, setTemplateIndex] = useState(0);

  function handleSubmit() {
    if (kind === "photo") {
      props.onGenerate(details.trim());
    } else {
      const template = MOTION_TEMPLATES[templateIndex];
      const motionPrompt = [details.trim(), template.keywords].filter(Boolean).join(", ");
      props.onGenerate(motionPrompt);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal generate-media-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{kind === "photo" ? `Generate a photo of ${persona.name}` : `Animate a photo of ${persona.name}`}</h3>

        {persona.appearance ? (
          <p className="hint">
            Always included: <em>{persona.appearance}</em>
            <br />
            (edit this character's "Appearance" field in the persona editor to change it)
          </p>
        ) : (
          <p className="hint">
            This character has no "Appearance" set, so only what you type below will be used. Set one in the
            persona editor for more consistent results.
          </p>
        )}

        {kind === "video" && (
          <label>
            Motion style
            <select value={templateIndex} onChange={(e) => setTemplateIndex(Number(e.target.value))}>
              {MOTION_TEMPLATES.map((t, i) => (
                <option key={t.label} value={i}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          {kind === "photo" ? "Add details (pose, outfit, setting…) — optional" : "Add motion details — optional"}
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            autoFocus
            placeholder={
              kind === "photo"
                ? "e.g. sitting in the garden, holding a cup of chai, smiling"
                : "e.g. turning to look at the camera"
            }
          />
        </label>

        <div className="modal-actions">
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={handleSubmit} disabled={busy}>
            {busy ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}
