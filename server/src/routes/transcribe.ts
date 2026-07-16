import { Router } from "express";
import { transcribe, WhisperError } from "../whisper.js";

export const transcribeRouter = Router();

transcribeRouter.post("/", async (req, res) => {
  const audio = req.body as Buffer;
  if (!Buffer.isBuffer(audio) || audio.length === 0) {
    res.status(400).json({ error: "No audio data received" });
    return;
  }

  const mimeType = req.headers["content-type"] ?? "audio/webm";
  try {
    const text = await transcribe(audio, mimeType);
    res.json({ text });
  } catch (err) {
    const message = err instanceof WhisperError ? err.message : "Transcription failed.";
    res.status(503).json({ error: message });
  }
});
