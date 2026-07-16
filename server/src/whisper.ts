// Thin client for a local whisper.cpp server (examples/server in the
// whisper.cpp repo, or any server implementing the same /inference API).
// Like ollama.ts, this only ever talks to a loopback address.

const WHISPER_HOST = process.env.WHISPER_HOST ?? "http://127.0.0.1:8081";

export class WhisperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhisperError";
  }
}

/**
 * Sends a recorded audio clip to a local whisper.cpp server and returns
 * the transcribed text.
 */
export async function transcribe(audio: Buffer, mimeType: string): Promise<string> {
  const form = new FormData();
  const extension = mimeType.includes("wav") ? "wav" : mimeType.includes("ogg") ? "ogg" : "webm";
  form.append("file", new Blob([Uint8Array.from(audio)], { type: mimeType }), `speech.${extension}`);
  form.append("response_format", "json");

  let res: Response;
  try {
    res = await fetch(`${WHISPER_HOST}/inference`, { method: "POST", body: form });
  } catch {
    throw new WhisperError(
      `Could not reach a local Whisper server at ${WHISPER_HOST}. ` +
        "Start whisper.cpp's server (see README) or set WHISPER_HOST."
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new WhisperError(`Whisper transcription failed (${res.status}): ${body}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = (await res.json()) as { text?: string };
    return (data.text ?? "").trim();
  }
  return (await res.text()).trim();
}
