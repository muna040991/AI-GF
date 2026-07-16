// Client for a local ComfyUI server, used for image-to-video character
// selfies. Unlike the Ollama/whisper.cpp/Automatic1111 clients, the request
// shape here isn't a fixed REST call — ComfyUI executes a *workflow graph*
// you design in its UI, so there's no single JSON body that works for every
// install. What's stable and documented is the HTTP API around it
// (queue a workflow, poll for completion, fetch the output file), which is
// what this module implements. The graph itself comes from a workflow file
// you export from ComfyUI — see server/comfyui-workflow.example.json and
// the README.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMFYUI_HOST = process.env.COMFYUI_HOST ?? "http://127.0.0.1:8188";
const WORKFLOW_PATH = process.env.COMFYUI_WORKFLOW_PATH ?? join(__dirname, "..", "comfyui-workflow.json");

const IMAGE_INPUT_TITLE = "AI-GF Image Input";
const MOTION_PROMPT_TITLE = "AI-GF Motion Prompt";
const VIDEO_OUTPUT_TITLE = "AI-GF Video Output";

const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 5 * 60 * 1000; // video generation is slow, even locally on a GPU

export class ComfyUIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComfyUIError";
  }
}

interface ComfyNode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title?: string };
}
type ComfyWorkflow = Record<string, ComfyNode>;

function loadWorkflow(): ComfyWorkflow {
  if (!existsSync(WORKFLOW_PATH)) {
    throw new ComfyUIError(
      `No ComfyUI workflow found at ${WORKFLOW_PATH}. Copy server/comfyui-workflow.example.json to ` +
        "server/comfyui-workflow.json and adjust it for your installed checkpoints/nodes (see README)."
    );
  }
  try {
    return JSON.parse(readFileSync(WORKFLOW_PATH, "utf-8"));
  } catch {
    throw new ComfyUIError(`Could not parse ${WORKFLOW_PATH} as JSON.`);
  }
}

function findNodeByTitle(workflow: ComfyWorkflow, title: string): [string, ComfyNode] | null {
  for (const entry of Object.entries(workflow)) {
    if (entry[1]._meta?.title === title) return entry;
  }
  return null;
}

async function guardedFetch(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${COMFYUI_HOST}${path}`, init);
  } catch {
    throw new ComfyUIError(
      `Could not reach a local ComfyUI server at ${COMFYUI_HOST}. Start ComfyUI (see README) or set COMFYUI_HOST.`
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ComfyUIError(`ComfyUI request to ${path} failed (${res.status}): ${body}`);
  }
  return res;
}

async function uploadImage(dataUri: string): Promise<string> {
  const commaIndex = dataUri.indexOf(",");
  const base64 = dataUri.startsWith("data:") && commaIndex !== -1 ? dataUri.slice(commaIndex + 1) : dataUri;
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));

  const form = new FormData();
  form.append("image", new Blob([bytes], { type: "image/png" }), "ai-gf-input.png");
  form.append("overwrite", "true");

  const res = await guardedFetch("/upload/image", { method: "POST", body: form });
  const data = (await res.json()) as { name: string };
  return data.name;
}

/**
 * Runs the configured local image-to-video ComfyUI workflow against a
 * source image and motion prompt, returning the resulting clip as a
 * data URI. Requires server/comfyui-workflow.json with three nodes titled
 * "AI-GF Image Input", "AI-GF Motion Prompt", and "AI-GF Video Output"
 * (set via each node's title in the ComfyUI UI) so this client knows where
 * to patch in the image/prompt and where to read the result from,
 * regardless of the rest of the graph's shape.
 */
export async function generateVideo(imageDataUri: string, motionPrompt: string): Promise<string> {
  const workflow = loadWorkflow();

  const imageNode = findNodeByTitle(workflow, IMAGE_INPUT_TITLE);
  if (!imageNode) throw new ComfyUIError(`Workflow is missing a node titled "${IMAGE_INPUT_TITLE}".`);
  const outputNode = findNodeByTitle(workflow, VIDEO_OUTPUT_TITLE);
  if (!outputNode) throw new ComfyUIError(`Workflow is missing a node titled "${VIDEO_OUTPUT_TITLE}".`);
  const promptNode = findNodeByTitle(workflow, MOTION_PROMPT_TITLE);

  const uploadedFilename = await uploadImage(imageDataUri);
  imageNode[1].inputs.image = uploadedFilename;
  if (promptNode && motionPrompt.trim()) {
    promptNode[1].inputs.text = motionPrompt.trim();
  }

  const queueRes = await guardedFetch("/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow, client_id: `ai-gf-${Date.now()}` }),
  });
  const queued = (await queueRes.json()) as { prompt_id?: string; error?: unknown };
  if (!queued.prompt_id) {
    throw new ComfyUIError(`ComfyUI rejected the workflow: ${JSON.stringify(queued.error ?? queued)}`);
  }

  const outputNodeId = outputNode[0];
  const deadline = Date.now() + MAX_WAIT_MS;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const historyRes = await guardedFetch(`/history/${queued.prompt_id}`);
    const history = (await historyRes.json()) as Record<string, { outputs?: Record<string, unknown> }>;
    const outputs = history[queued.prompt_id]?.outputs;
    if (!outputs) continue;

    const nodeOutput = outputs[outputNodeId] as
      | { gifs?: Array<{ filename: string; subfolder: string; type: string }> }
      | undefined;
    const file = nodeOutput?.gifs?.[0];
    if (!file) continue;

    const params = new URLSearchParams({ filename: file.filename, subfolder: file.subfolder, type: file.type });
    const videoRes = await guardedFetch(`/view?${params}`);
    const buffer = Buffer.from(await videoRes.arrayBuffer());
    return `data:video/mp4;base64,${buffer.toString("base64")}`;
  }

  throw new ComfyUIError("Timed out waiting for ComfyUI to finish generating the video.");
}
