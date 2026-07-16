// Thin client for a local Automatic1111 (stable-diffusion-webui) server,
// used for in-chat character image generation. Loopback-only, like every
// other local service this app talks to.

const SD_HOST = process.env.SD_HOST ?? "http://127.0.0.1:7860";

export class StableDiffusionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StableDiffusionError";
  }
}

interface Txt2ImgResponse {
  images?: string[];
}

/**
 * Generates an image from a prompt via a local Automatic1111 server.
 * Returns a data URI (image/png) ready to store/display directly.
 */
export async function generateImage(prompt: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${SD_HOST}/sdapi/v1/txt2img`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        negative_prompt: "blurry, distorted, extra limbs, text, watermark",
        steps: 20,
        width: 512,
        height: 512,
        cfg_scale: 7,
        sampler_name: "Euler a",
      }),
    });
  } catch {
    throw new StableDiffusionError(
      `Could not reach a local Stable Diffusion server at ${SD_HOST}. ` +
        "Start Automatic1111's webui with --api (see README) or set SD_HOST."
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new StableDiffusionError(`Image generation failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as Txt2ImgResponse;
  const image = data.images?.[0];
  if (!image) throw new StableDiffusionError("Stable Diffusion server returned no image.");

  return `data:image/png;base64,${image}`;
}
