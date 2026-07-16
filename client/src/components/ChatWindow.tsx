import { useEffect, useRef, useState } from "react";
import { api, sendMessageStream, type Message, type Persona } from "../api.js";

interface Props {
  persona: Persona;
  conversationId: string;
}

export function ChatWindow({ persona, conversationId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.listMessages(conversationId).then(setMessages);
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

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
      },
      onError: (message) => {
        setError(message);
        setStreamingText(null);
        setSending(false);
      },
    });
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <span className="avatar-dot" style={{ background: persona.avatarColor }} />
        <div>
          <div className="chat-title">{persona.name}</div>
          <div className="chat-subtitle">{persona.model}</div>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`bubble ${message.role}`}>
            {message.content}
          </div>
        ))}
        {streamingText !== null && <div className="bubble assistant">{streamingText || "…"}</div>}
        {error && <div className="bubble error">{error}</div>}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={`Message ${persona.name}…`}
          rows={2}
        />
        <button onClick={handleSend} disabled={sending || !draft.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
