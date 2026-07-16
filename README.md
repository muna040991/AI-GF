# Unlucid Mohini

A fully offline, local-only AI chat companion. The app itself never makes a
network call — all inference runs through local services on `127.0.0.1`
([Ollama](https://ollama.com) for chat, and optional local servers for voice
and images), so conversations never leave your machine.

It doesn't add any of its own content filtering on top of the model — the
character's tone and boundaries come entirely from the persona's system
prompt and whichever local model you choose to run. You are responsible for
selecting a model whose license and behavior you're comfortable with, and for
following your local laws for any content you generate. Characters must be
18+; nothing else about content is restricted by the app.

## Features

**Chat**
- Persistent chat history, saved locally (`data/store.json`)
- Streaming replies, **regenerate** the last reply, **swipe** through
  alternate regenerated replies, **edit** or **delete** any message
- **Pin** standout messages and filter a conversation down to pinned-only
- Markdown-ish rendering: `**bold**`, `*italic roleplay actions*`, `` `code` ``
- **Full-text search** across every conversation, with every character

**Characters**
- Custom personas: name, system prompt, model, color, and an **avatar image**
- Per-persona **model settings** — temperature and max reply length
- **Long-term memory**: periodically distills durable facts from a
  conversation and recalls the relevant ones (via local embeddings) in later
  chats — with a viewer/editor to see, add, or delete what's remembered
- **Character card import/export** in the widely-used Character Card V2 JSON
  shape, so characters can be shared with (or pulled in from) other tools
- Ships with two starter characters (Yamuna and Yallamma) pre-seeded on first
  run, so it's not a blank slate — edit or delete them like any other
  character (`server/src/seedPersonas.ts`)
- **Photo gallery**: store multiple reference photos per character (once
  they're saved). Tap ★ on any photo to promote it to that character's style
  reference; same loose-style behavior as above, not identity-locking

**Voice**
- **Voice input**: mic button, transcribed locally via whisper.cpp
- **Voice output**: replies read aloud via the browser's built-in, on-device
  speech synthesis, with a distinct voice per character
- **Continuous call mode**: hands-free back-and-forth — recording auto-resumes
  after each spoken reply finishes

**Images & video**
- **AI-generated selfies**: local Stable Diffusion (Automatic1111) generates
  an in-character photo on request
- **Style reference image**: optionally upload a reference photo per
  character; generated selfies are nudged toward its general color
  palette/vibe via img2img. This is loose stylistic continuity, not
  identity-locked photorealistic likeness generation — this app doesn't do
  that by design, regardless of the reference image
- **Vision input**: attach a photo in chat for the character to respond to
  (needs a vision-capable local model, e.g. `llava`)
- **Animate a selfie into a short video**: local ComfyUI turns the most
  recent photo (generated, attached, the style reference, or the character's
  avatar) into a video clip, with a motion-prompt box and a few motion
  templates (Cinematic Zoom, Slow Pan, Dramatic Reveal, Gentle Sway);
  download or keep it in the chat

**App**
- **Light/dark theme** toggle
- **Mobile-friendly PWA**: installable, responsive off-canvas sidebar, basic
  offline app-shell caching
- **Encrypted local backup**: export everything (characters, conversations,
  memories) as a passphrase-encrypted file, and restore it later

## Architecture

```
client/  React + Vite UI       (http://127.0.0.1:5173)
server/  Express API           (http://127.0.0.1:5174, loopback only)
           |
           +--> Ollama              (http://127.0.0.1:11434)  chat + embeddings
           |
           +--> whisper.cpp server  (http://127.0.0.1:8081)   speech-to-text
           |
           +--> Automatic1111       (http://127.0.0.1:7860)   image generation
           |
           +--> ComfyUI             (http://127.0.0.1:8188)   image-to-video
```

The Express server is the only thing that talks to Ollama, whisper.cpp,
Automatic1111, or ComfyUI; the browser only ever talks to the Express server.
All of them are bound to loopback. Voice *output* (text-to-speech) needs no
server at all — it uses the browser's built-in `speechSynthesis`, which runs
on-device.

Note: voice input deliberately does **not** use the browser's built-in
`SpeechRecognition` API — in Chrome/Edge that quietly sends your audio to
Google's servers for transcription, which would break the offline guarantee
this app is built around. Recorded audio is instead transcribed locally via
whisper.cpp.

Every "local service" here (Ollama, whisper.cpp, Automatic1111, ComfyUI) is
optional independently — the app degrades gracefully with a clear inline
error if one isn't running, rather than breaking anything else.

## Quick setup (Windows, no command-line experience needed)

Model files (the actual AI "brains") are multiple gigabytes each —
`dolphin-mistral` alone is about 4 GB. GitHub hard-blocks any file over
100 MB, so they can't be bundled into this repository; there's no way
around that limit. What's included instead is a script that downloads them
for you automatically, using Ollama's own downloader (which is built for
exactly this, unlike Git):

1. On this repo's GitHub page, click the green **Code** button →
   **Download ZIP**, then extract the ZIP to a folder (e.g. your Desktop).
   You should end up with a folder containing files like `README.md`,
   `setup-windows.bat`, `package.json`, etc.
2. Install [Node.js](https://nodejs.org) (click the **LTS** button) and
   [Ollama](https://ollama.com) if you haven't already — both are quick
   installers, click Next through the defaults, no options to configure.
   Restart your computer after installing if it asks you to.
3. Open that extracted folder and double-click **`setup-windows.bat`**.
   A black window will open and print progress messages. This step
   downloads the AI model (~4 GB) so it needs a decent internet connection
   and can take anywhere from a few minutes to a while depending on your
   speed — **wait until it prints "Setup complete!"** before doing
   anything else. If it prints an `[ERROR]` line instead, read that line —
   it tells you exactly what to fix (usually: install Node.js/Ollama, or
   check your internet connection) before running it again.
4. Once you see "Setup complete!", double-click **`start-windows.bat`**
   any time you want to run the app. Two windows will open: one with the
   app's logs (leave it running in the background) and, a few seconds
   later, your normal web browser opens to the app automatically —
   no security warnings, no extra clicks.
5. To close the app, close the black "Unlucid Mohini Server" window (or
   just close it whenever you're done chatting). Your characters and
   conversations are saved automatically and will still be there next
   time you run `start-windows.bat`.

Want to also try it from your phone? See
[Testing on your phone](#testing-on-your-phone) below — it needs one
extra one-click script (`start-windows-phone.bat`).

### If something goes wrong

- **"Can't reach this page" / `ERR_CONNECTION_REFUSED`** in the browser —
  this means the app server wasn't actually running yet when the browser
  opened. Almost always this means step 3 above (`setup-windows.bat`)
  never finished. Close everything, re-run `setup-windows.bat`, and
  confirm it prints **"Setup complete!"** at the end before you run
  `start-windows.bat`.
- **`start-windows.bat` immediately shows a red `[ERROR]`** — it's telling
  you setup hasn't finished; follow the message it prints.
- **The black server window shows red error text** — that's the real
  problem to read; common ones are "Ollama unreachable" (Ollama isn't
  running — just open the Ollama app once and leave it running in the
  background) or a port already in use (close any other copy of the app
  you already have running, including old black windows from a previous
  attempt).
- **Antivirus/Windows Defender flags the `.bat` files or blocks the
  browser opening** — these scripts only run `npm install`/`ollama pull`/
  `npm run dev` and open your local browser; if prompted, allow them.
- Still stuck? Look at the text in the black "Unlucid Mohini Server"
  window — it says exactly what failed, which is the fastest way to
  figure out the fix.

Everything below explains what those scripts are doing under the hood,
and covers Mac/Linux and the optional voice/image/video extras.

## Setup

### 1. Install Ollama

Download it from https://ollama.com and start the daemon (`ollama serve`, or
just launch the app — most installs run it as a background service).

### 2. Pull a chat model

Any model in Ollama's library works — pick one whose behavior suits you.
Some commonly used uncensored/lightly-aligned options:

```bash
ollama pull dolphin-mistral        # good general default, fast
ollama pull dolphin-mixtral        # larger, more capable
ollama pull llama2-uncensored
ollama pull wizard-vicuna-uncensored
```

Any other model (`llama3.1`, `mixtral`, `qwen2.5`, etc.) will also work —
the model picker in the app lists whatever you've pulled locally. For vision
input (sending photos in chat), pull a vision-capable model instead, e.g.
`ollama pull llava`.

### 3. (Optional) Pull an embedding model for long-term memory

```bash
ollama pull nomic-embed-text
```

If you skip this, the app still works fine — memory retrieval just quietly
returns nothing until embeddings are available.

### 4. (Optional) Set up local voice input

Voice *output* (text-to-speech) works out of the box with no setup — it's
built into your browser. Voice *input* (speech-to-text) needs a local
whisper.cpp server:

```bash
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
sh ./models/download-ggml-model.sh base.en   # or a larger model for more accuracy
cmake -B build && cmake --build build -j --config Release
./build/bin/whisper-server -m models/ggml-base.en.bin --port 8081
```

Leave that running in the background. If you skip this step, the app still
works fine — the mic button will just show a "couldn't reach Whisper"
error, and you can keep typing as usual.

### 5. (Optional) Set up local image generation

For AI-generated character selfies, install
[Automatic1111's stable-diffusion-webui](https://github.com/AUTOMATIC1111/stable-diffusion-webui)
and launch it with its API enabled:

```bash
./webui.sh --api   # or webui-user.bat --api on Windows
```

Leave that running in the background on its default port (7860). Skipping
this step just makes the selfie button show a clear "couldn't reach Stable
Diffusion" error instead of breaking anything else. For best results, fill
in a character's **Appearance** field in the persona editor — it's used as
the base prompt for every selfie generated for that character (the 📷
button's popup shows you exactly what's included before generating, and
lets you add more detail on top).

**Getting better image quality:** by far the biggest factor is which
checkpoint you have loaded in Automatic1111 — the app's defaults are just a
starting point, not a ceiling. Match these to what your checkpoint actually
wants (check its model card, or just match whatever resolution/sampler you
already use in the webui itself) via env vars before running the app:

```bash
# Example for an SDXL checkpoint (e.g. epicjuggernautXL) at 768x1024, Karras:
SD_WIDTH=768 SD_HEIGHT=1024 SD_SAMPLER="DPM++ 2M SDE" SD_SCHEDULER=karras npm run dev
```

- `SD_WIDTH` / `SD_HEIGHT` (default 512x512 — safe for most SD1.5-family
  checkpoints; SDXL checkpoints usually want 1024x1024 or 768x1024+)
- `SD_STEPS` (default 28), `SD_CFG_SCALE` (default 7)
- `SD_SAMPLER` (default `Euler a`), `SD_SCHEDULER` (unset by default; try
  `karras` if your checkpoint's own defaults use it)
- `SD_NEGATIVE_PROMPT` to override the default negative prompt
- `SD_HIRES_FIX=true` to enable a 1.5x hires fix pass on SD1.5 checkpoints
  (sharper detail than raw upscaling to a resolution they weren't trained
  for)

Set these permanently via the `.bat` scripts (or a `.env` file) rather than
retyping them each time — see the Notes section below for how env vars are
picked up.

**On face-swap extensions (ReActor, etc.):** this app doesn't wire those in,
and won't — pasting a specific face (especially a real person's) onto every
generated image is exactly the identity-locked generation this project
deliberately doesn't do. The style-reference image (loose palette/vibe
only, see above) is the supported way to nudge generations toward a
character's look.

### 6. (Optional) Set up local image-to-video generation

Animating a selfie into a video needs a local
[ComfyUI](https://github.com/comfyanonymous/ComfyUI) server:

```bash
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI
pip install -r requirements.txt
python main.py   # defaults to http://127.0.0.1:8188
```

Unlike Automatic1111, ComfyUI doesn't have one fixed "generate" endpoint —
you build a workflow *graph* in its UI (which nodes, which checkpoints,
which custom nodes), and that graph is what actually gets sent to run. There's
no single JSON payload that works for everyone's install, so:

1. Build (or import) an image-to-video workflow in the ComfyUI UI — e.g. the
   built-in Stable Video Diffusion template, or an AnimateDiff-based one if
   you want the motion prompt text box to actually influence the motion
   (plain SVD is image-only and ignores it).
2. Right-click your image-loading node → **Properties** → set **Title** to
   exactly `Unlucid Mohini Image Input`.
3. Right-click your final video-output node (e.g. a Video Helper Suite
   "Video Combine" node) → set its **Title** to exactly
   `Unlucid Mohini Video Output`.
4. If your workflow has a text-prompt node driving motion, title it
   `Unlucid Mohini Motion Prompt` — optional, only wire this up if your
   workflow actually uses text conditioning.
5. Export via **Workflow → Export (API Format)** and save it as
   `server/comfyui-workflow.json` (gitignored — it's your local setup, not
   checked in).

`server/comfyui-workflow.example.json` is a minimal Stable Video Diffusion
skeleton to start from — it's a real, structurally valid ComfyUI graph, but
you'll need to point `ckpt_name`/`clip_name` at checkpoints you actually have
installed before it'll run. Skipping this whole step just makes the 🎬
Animate button show a clear "couldn't reach ComfyUI" (or "no workflow
configured") error instead of breaking anything else.

### 7. Install and run the app

```bash
npm install
npm run dev
```

This starts the API server on port 5174 and the Vite dev server on port
5173. Open http://127.0.0.1:5173, create a character, pick a local model,
and start chatting.

### Testing on your phone

**Windows, no command line:** double-click **`start-windows-phone.bat`**
instead of `start-windows.bat`. It starts the app with voice input enabled
for your phone, prints the exact web address to type into your phone's
browser, and opens the app on your computer too. Your phone just needs to
be on the same WiFi network as your computer.

**Manual steps (any OS):** you can open the app from a phone on the same
WiFi as your computer — no extra setup needed, `npm run dev` already
allows it:

1. Find your computer's local network address: on Windows, run `ipconfig`
   and look for "IPv4 Address" (something like `192.168.1.23`); on
   Mac/Linux, run `ifconfig` (or `ip addr`) and look for a similar address
   under your WiFi adapter.
2. Make sure your phone is on the **same WiFi network** as your computer.
3. On your phone's browser, go to `http://<that address>:5173` — e.g.
   `http://192.168.1.23:5173`.
4. Your computer's firewall may prompt to allow the connection the first
   time — allow it (it's your local network, not the internet).

This never leaves your WiFi network — it's the same offline guarantee,
just reachable from another device you own. **One caveat**: the mic button
(voice input) needs a "secure context" (HTTPS or `localhost`), which a
plain `http://192.168.x.x` address doesn't count as — most mobile browsers
will silently block microphone access there. Text chat, images, and video
all work fine over plain HTTP; only voice *input* is affected (voice
*output* still works everywhere).

#### Testing voice input too (HTTPS)

`start-windows-phone.bat` already does this step for you. If you're doing
it manually instead, run the HTTPS variant:

```bash
npm run dev:https
```

This is the exact same app — it just wraps the dev server in a
locally-generated, self-signed TLS certificate (via
`@vitejs/plugin-basic-ssl`, nothing sent anywhere, generated fresh on your
machine). Then:

1. On your phone, go to `https://<that address>:5173` (note **https**, not
   http) — e.g. `https://192.168.1.23:5173`.
2. Your phone's browser will show a warning like "Your connection is not
   private" or "This connection is not secure" — **this is expected**, not
   a real problem. It's because the certificate is self-signed by your own
   computer rather than issued by a public authority; there's no way around
   this for a private local address.
   - **Chrome (Android)**: tap "Advanced", then "Proceed to \<address\>
     (unsafe)".
   - **Safari (iOS)**: tap "Show Details", then "visit this website", then
     confirm.
3. Once past that warning, the mic button will prompt for microphone
   permission normally and voice input will work.

Use plain `npm run dev` day-to-day (no warnings to click through); switch
to `npm run dev:https` only when you specifically want to test voice input
from another device.

### Production build

```bash
npm run build
npm start   # serves the built API on 5174; serve client/dist with any static file server
```

## Notes

- All data lives in `data/store.json`. Delete it to reset everything, or use
  Settings → Export encrypted backup first to keep a copy.
- `HOST` env var (default `127.0.0.1`, loopback-only) controls what the
  **production** server (`npm start`) binds to. Set `HOST=0.0.0.0` for the
  same local-network phone access described above; `npm run dev` already
  allows this without any env var.
- `OLLAMA_HOST` env var can point the server at a non-default Ollama address
  (still expected to be local/offline).
- `EMBED_MODEL` env var (default `nomic-embed-text`) selects the embedding
  model used for memory retrieval.
- `WHISPER_HOST` env var (default `http://127.0.0.1:8081`) points at your
  local whisper.cpp server for voice input.
- `SD_HOST` env var (default `http://127.0.0.1:7860`) points at your local
  Automatic1111 server for image generation. When a character has a style
  reference image set, generation uses `img2img` at denoising strength 0.65
  (moderate — prompt-driven, loosely style-anchored) instead of `txt2img`.
- `COMFYUI_HOST` env var (default `http://127.0.0.1:8188`) points at your
  local ComfyUI server for image-to-video generation. `COMFYUI_WORKFLOW_PATH`
  overrides where the workflow JSON is read from (default
  `server/comfyui-workflow.json`).
- The 🎬 Animate button animates, in order of preference: an image you
  explicitly pick, the most recently generated/attached image in the current
  conversation, the character's style reference image, or its avatar image.
- Voice output uses whichever system/browser voices are installed. Pick a
  per-character voice in the persona editor, or leave it on "Browser default".
- The mic button records with `MediaRecorder`; browsers require a secure
  context (`http://127.0.0.1` counts, `http://<lan-ip>` does not) to grant
  microphone access.
- Regenerate/swipe only apply to the most recent assistant reply in a
  conversation — matches how most chat/roleplay UIs handle it, and avoids
  silently invalidating everything that came after an earlier message.
- Character card export/import uses the "Character Card V2" JSON shape
  (the same one SillyTavern/Character.AI-style tools use), with this app's
  extra fields (model, temperature, voice, etc.) riding along in
  `data.extensions.aigf` for full round-trip fidelity between installs.
