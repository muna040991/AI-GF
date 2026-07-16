import { Router } from "express";
import { listModels, OllamaError } from "../ollama.js";

export const modelsRouter = Router();

modelsRouter.get("/", async (_req, res) => {
  try {
    const models = await listModels();
    res.json(models);
  } catch (err) {
    const message = err instanceof OllamaError ? err.message : "Failed to list local models.";
    res.status(503).json({ error: message });
  }
});
