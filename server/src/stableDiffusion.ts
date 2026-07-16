// Thin client for a local Automatic1111 (stable-diffusion-webui) server,
// used for in-chat character image generation. Loopback-only, like every
// other local service this app talks to.

import { toRawBase64 } from "./ollama.js";

const SD_HOST = process.env.SD_HOST ?? "http://127.0.0.1:7860";

// Moderate denoising for the optional style-reference path: high enough that
// the prompt still drives what's actually generated, low enough that the
// reference's color palette/composition/general vibe loosely carries over.
// This is deliberately NOT tuned for precise identity/face reproduction —
// see Persona.styleReferenceImage's doc comment for why.
const STYLE_REFERENCE_DENOISING_STRENGTH = 0.65;

export class StableDiffusionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StableDiffusionError";
  }
}

interface ImageResponse {
  images?: string[];
}

// Image quality is driven almost entirely by which checkpoint is loaded in
// Automatic1111, not by these numbers — but they're worth tuning to match
// your checkpoint. 512x512 is the safe default for most SD1.5-family
// "uncensored" checkpoints; going higher without a checkpoint trained for it
// (SDXL-based, or SD1.5 + hires fix) produces duplicated limbs/faces instead
// of a sharper image. If your checkpoint is SDXL-based, try SD_WIDTH=1024
// SD_HEIGHT=1024. All of these are overridable per-install via env vars.
const BASE_PARAMS = {
  negative_prompt: process.env.SD_NEGATIVE_PROMPT ?? "blurry, distorted, extra limbs, text, watermark",
  steps: Number(process.env.SD_STEPS ?? 28),
  width: Number(process.env.SD_WIDTH ?? 512),
  height: Number(process.env.SD_HEIGHT ?? 512),
  cfg_scale: Number(process.env.SD_CFG_SCALE ?? 7),
  sampler_name: process.env.SD_SAMPLER ?? "Euler a",
  ...(process.env.SD_SCHEDULER ? { scheduler: process.env.SD_SCHEDULER } : {}),
  ...(process.env.SD_HIRES_FIX === "true" ? { enable_hr: true, hr_scale: 1.5, hr_upscaler: "Latent" } : {}),
};

async function postToStableDiffusion(path: string, body: unknown): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${SD_HOST}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new StableDiffusionError(
      `Could not reach a local Stable Diffusion server at ${SD_HOST}. ` +
        "Start Automatic1111's webui with --api (see README) or set SD_HOST."
    );
  }

  if (!res.ok) {
    const responseBody = await res.text().catch(() => "");
    throw new StableDiffusionError(`Image generation failed (${res.status}): ${responseBody}`);
  }

  const data = (await res.json()) as ImageResponse;
  const image = data.images?.[0];
  if (!image) throw new StableDiffusionError("Stable Diffusion server returned no image.");
  return `data:image/png;base64,${image}`;
}

/**
 * Generates an image from a prompt via a local Automatic1111 server. When a
 * style reference image is given, uses img2img at a moderate denoising
 * strength for loose stylistic continuity (palette, outfit vibe) with the
 * character's look — not a precise likeness/face match, by design.
 */
export async function generateImage(prompt: string, styleReferenceImage?: string): Promise<string> {
  if (styleReferenceImage) {
    return postToStableDiffusion("/sdapi/v1/img2img", {
      ...BASE_PARAMS,
      prompt,
      init_images: [toRawBase64(styleReferenceImage)],
      denoising_strength: STYLE_REFERENCE_DENOISING_STRENGTH,
    });
  }

  return postToStableDiffusion("/sdapi/v1/txt2img", { ...BASE_PARAMS, prompt });
}
