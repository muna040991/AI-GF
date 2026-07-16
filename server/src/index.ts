import cors from "cors";
import express from "express";
import { conversationsRouter } from "./routes/conversations.js";
import { modelsRouter } from "./routes/models.js";
import { personasRouter } from "./routes/personas.js";
import { transcribeRouter } from "./routes/transcribe.js";
import { ensureSeedPersonas } from "./seedPersonas.js";

const app = express();
const PORT = Number(process.env.PORT ?? 5174);

ensureSeedPersonas();

// Local-only: bind to loopback and allow only the local dev/client origin.
// Nothing here ever talks to anything beyond this machine.
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.raw({ type: "audio/*", limit: "25mb" }));

app.use("/api/personas", personasRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/models", modelsRouter);
app.use("/api/transcribe", transcribeRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`AI-GF server listening on http://127.0.0.1:${PORT} (loopback only)`);
});
