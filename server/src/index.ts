import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import { config as loadEnvFile } from "dotenv";
import express from "express";
import { backupRouter } from "./routes/backup.js";
import { conversationsRouter } from "./routes/conversations.js";
import { memoriesRouter } from "./routes/memories.js";
import { modelsRouter } from "./routes/models.js";
import { personasRouter } from "./routes/personas.js";
import { searchRouter } from "./routes/search.js";
import { transcribeRouter } from "./routes/transcribe.js";
import { ensureSeedPersonas } from "./seedPersonas.js";

// Loads a .env file from the project root (two levels up from this
// compiled file: server/dist/index.js -> server -> root), if one exists —
// e.g. OPENROUTER_API_KEY, so it doesn't need to be retyped every launch.
// Nothing here reads that key or sends anything anywhere on its own; it's
// only used if you explicitly set a persona's provider to "openrouter".
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFile({ path: join(__dirname, "..", "..", ".env") });

const app = express();
const PORT = Number(process.env.PORT ?? 5174);
// Defaults to loopback-only. Set HOST=0.0.0.0 to also allow other devices
// on your local network (e.g. testing from a phone) — never binds beyond
// your own network either way.
const HOST = process.env.HOST ?? "127.0.0.1";

ensureSeedPersonas();

// Local-only: nothing here ever talks to anything beyond your own machine
// or local network. The generous JSON limit is for base64 avatar/selfie
// images and full-store backups.
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.raw({ type: "audio/*", limit: "25mb" }));

app.use("/api/personas", personasRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/models", modelsRouter);
app.use("/api/transcribe", transcribeRouter);
app.use("/api/memories", memoriesRouter);
app.use("/api/search", searchRouter);
app.use("/api/backup", backupRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, HOST, () => {
  const scope = HOST === "127.0.0.1" ? "loopback only" : "local network";
  console.log(`Unlucid Mohini server listening on http://${HOST}:${PORT} (${scope})`);
});
