# AI-GF

A fully offline, local-only AI chat companion. The app itself never makes a
network call — all inference runs through a local [Ollama](https://ollama.com)
daemon on `127.0.0.1`, so conversations never leave your machine.

It doesn't add any of its own content filtering on top of the model — the
character's tone and boundaries come entirely from the persona's system
prompt and whichever local model you choose to run. You are responsible for
selecting a model whose license and behavior you're comfortable with, and for
following your local laws for any content you generate.

## Features

- **Persistent chat history** — conversations are saved locally (`data/store.json`)
- **Custom personas** — editable name, system prompt, model and color per character
- **Long-term memory** — periodically distills durable facts from a conversation and
  recalls the relevant ones (via local embeddings) in later chats with that character
- **Multiple characters/models** — switch between saved personas, each can use a
  different local model
- **Voice input/output** — talk to the app with your mic (transcribed locally via
  whisper.cpp) and have replies read back out loud (via the browser's built-in,
  on-device speech synthesis), with a distinct voice per character
- **Starter character** — ships with one example persona (Yamuna) pre-seeded on
  first run, so it's not a blank slate; edit or delete her like any other
  character (`server/src/seedPersonas.ts`)

## Architecture

```
client/  React + Vite UI  (http://127.0.0.1:5173)
server/  Express API      (http://127.0.0.1:5174, loopback only)
           |
           +--> Ollama            (http://127.0.0.1:11434)  chat + embeddings
           |
           +--> whisper.cpp server (http://127.0.0.1:8081)  speech-to-text
```

The Express server is the only thing that talks to Ollama or whisper.cpp; the
browser only ever talks to the Express server. All three are bound to
loopback. Voice *output* (text-to-speech) needs no server at all — it uses
the browser's built-in `speechSynthesis`, which runs on-device.

Note: voice input deliberately does **not** use the browser's built-in
`SpeechRecognition` API — in Chrome/Edge that quietly sends your audio to
Google's servers for transcription, which would break the offline guarantee
this app is built around. Recorded audio is instead transcribed locally via
whisper.cpp.

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
the model picker in the app lists whatever you've pulled locally.

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

### 5. Install and run the app

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

- All data lives in `data/store.json`. Delete it to reset everything.
- `OLLAMA_HOST` env var can point the server at a non-default Ollama address
  (still expected to be local/offline).
- `EMBED_MODEL` env var (default `nomic-embed-text`) selects the embedding
  model used for memory retrieval.
- `WHISPER_HOST` env var (default `http://127.0.0.1:8081`) points at your
  local whisper.cpp server for voice input.
- Voice output uses whichever system/browser voices are installed. Pick a
  per-character voice in the persona editor, or leave it on "Browser default".
- The mic button records with `MediaRecorder`; browsers require a secure
  context (`http://127.0.0.1` counts, `http://<lan-ip>` does not) to grant
  microphone access.
