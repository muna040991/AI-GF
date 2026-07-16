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

## Architecture

```
client/  React + Vite UI  (http://127.0.0.1:5173)
server/  Express API      (http://127.0.0.1:5174, loopback only)
           |
           v
        Ollama          (http://127.0.0.1:11434)
```

The Express server is the only thing that talks to Ollama; the browser only
ever talks to the Express server. Both are bound to loopback.

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

### 4. Install and run the app

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
