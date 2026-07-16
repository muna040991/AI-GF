# AI-GF

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

**Voice**
- **Voice input**: mic button, transcribed locally via whisper.cpp
- **Voice output**: replies read aloud via the browser's built-in, on-device
  speech synthesis, with a distinct voice per character
- **Continuous call mode**: hands-free back-and-forth — recording auto-resumes
  after each spoken reply finishes

**Images**
- **AI-generated selfies**: local Stable Diffusion (Automatic1111) generates
  an in-character photo on request
- **Vision input**: attach a photo in chat for the character to respond to
  (needs a vision-capable local model, e.g. `llava`)

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
```

The Express server is the only thing that talks to Ollama, whisper.cpp, or
Automatic1111; the browser only ever talks to the Express server. All of them
are bound to loopback. Voice *output* (text-to-speech) needs no server at
all — it uses the browser's built-in `speechSynthesis`, which runs on-device.

Note: voice input deliberately does **not** use the browser's built-in
`SpeechRecognition` API — in Chrome/Edge that quietly sends your audio to
Google's servers for transcription, which would break the offline guarantee
this app is built around. Recorded audio is instead transcribed locally via
whisper.cpp.

Every "local service" here (Ollama, whisper.cpp, Automatic1111) is optional
independently — the app degrades gracefully with a clear inline error if one
isn't running, rather than breaking anything else.

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
the base prompt for every selfie generated for that character.

### 6. Install and run the app

```bash
npm install
npm run dev
```

This starts the API server on port 5174 and the Vite dev server on port
5173. Open http://127.0.0.1:5173, create a character, pick a local model,
and start chatting.

### Production build

```bash
npm run build
npm start   # serves the built API on 5174; serve client/dist with any static file server
```

## Notes

- All data lives in `data/store.json`. Delete it to reset everything, or use
  Settings → Export encrypted backup first to keep a copy.
- `OLLAMA_HOST` env var can point the server at a non-default Ollama address
  (still expected to be local/offline).
- `EMBED_MODEL` env var (default `nomic-embed-text`) selects the embedding
  model used for memory retrieval.
- `WHISPER_HOST` env var (default `http://127.0.0.1:8081`) points at your
  local whisper.cpp server for voice input.
- `SD_HOST` env var (default `http://127.0.0.1:7860`) points at your local
  Automatic1111 server for image generation.
- Voice output uses whichever system/browser voices are installed. Pick a
  per-character voice in the persona editor, or leave it on "Browser default".
- The mic button records with `MediaRecorder`; browsers require a secure
  context (`http://127.0.0.1` counts, `http://<lan-ip>` does not) to grant
  microphone access.
- Regenerate/swipe only apply to the most recent assistant reply in a
  conversation — matches how most chat/roleplay UIs handle it, and avoids
  silently invalidating everything that came after an earlier message.
- Character card export/import uses the "Character Card V2" JSON shape
  (the same one SillyTavern/Character.AI-style tools use), with AI-GF's
  extra fields (model, temperature, voice, etc.) riding along in
  `data.extensions.aigf` for full round-trip fidelity between AI-GF installs.
