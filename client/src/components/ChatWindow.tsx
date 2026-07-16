import { useEffect, useRef, useState } from "react";
import { api, sendMessageStream, type Message, type Persona } from "../api.js";
import { speak, stopSpeaking } from "../tts.js";
import { useVoiceRecorder } from "../useVoiceRecorder.js";

interface Props {
  persona: Persona;
  conversationId: string;
}

const AUTO_SPEAK_KEY = "ai-gf:auto-speak";

export function ChatWindow({ persona, conversationId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem(AUTO_SPEAK_KEY) === "1");
  const bottomRef = useRef<HTMLDivElement>(null);

  const recorder = useVoiceRecorder(async (blob) => {
    try {
      const text = await api.transcribe(blob);
      setDraft((prev) => (prev ? `${prev} ${text}` : text));
      recorder.reset();
    } catch (err) {
      recorder.setError(err instanceof Error ? err.message : "Transcription failed.");
      recorder.setStatus("error");
    }
  });

  useEffect(() => {
    api.listMessages(conversationId).then(setMessages);
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => stopSpeaking, [conversationId]);

  function toggleAutoSpeak() {
    setAutoSpeak((prev) => {
      const next = !prev;
      localStorage.setItem(AUTO_SPEAK_KEY, next ? "1" : "0");
      if (!next) stopSpeaking();
      return next;
    });
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending) return;

    setDraft("");
    setError(null);
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, conversationId, role: "user", content, createdAt: Date.now() },
    ]);
    setStreamingText("");

    await sendMessageStream(conversationId, content, {
      onToken: (chunk) => setStreamingText((prev) => (prev ?? "") + chunk),
      onDone: (message) => {
        setMessages((prev) => [...prev, message]);
        setStreamingText(null);
        setSending(false);
        if (autoSpeak) speak(message.content, persona.voiceURI);
      },
      onError: (message) => {
        setError(message);
        setStreamingText(null);
        setSending(false);
      },
    });
  }

  function handleMicClick() {
    if (recorder.status === "recording") recorder.stop();
    else recorder.start();
  }

  const micLabel =
    recorder.status === "recording"
      ? "Stop recording"
      : recorder.status === "transcribing"
        ? "Transcribing…"
        : "Voice input";

  return (
    <div className="chat-window">
      <div className="chat-header">
        <span className="avatar-dot" style={{ background: persona.avatarColor }} />
        <div>
          <div className="chat-title">{persona.name}</div>
          <div className="chat-subtitle">{persona.model}</div>
        </div>
        <button
          className={`icon-btn speak-toggle ${autoSpeak ? "active" : ""}`}
          onClick={toggleAutoSpeak}
          title={autoSpeak ? "Auto-speak replies: on" : "Auto-speak replies: off"}
        >
          {autoSpeak ? "🔊" : "🔇"}
        </button>
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`bubble ${message.role}`}>
            {message.content}
            {message.role === "assistant" && (
              <button
                className="speak-btn"
                onClick={() => speak(message.content, persona.voiceURI)}
                title="Read aloud"
              >
                🔊
              </button>
            )}
          </div>
        ))}
        {streamingText !== null && <div className="bubble assistant">{streamingText || "…"}</div>}
        {error && <div className="bubble error">{error}</div>}
        {recorder.error && <div className="bubble error">{recorder.error}</div>}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input">
        <button
          className={`mic-btn ${recorder.status}`}
          onClick={handleMicClick}
          disabled={recorder.status === "transcribing"}
          title={micLabel}
        >
          {recorder.status === "recording" ? "⏹" : "🎤"}
        </button>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            recorder.status === "transcribing" ? "Transcribing…" : `Message ${persona.name}…`
          }
          rows={2}
        />
        <button onClick={handleSend} disabled={sending || !draft.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
