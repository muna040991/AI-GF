import { useEffect, useRef, useState } from "react";
import { api, regenerateMessageStream, sendMessageStream, type Message, type Persona } from "../api.js";
import { renderMarkdown } from "../markdown.js";
import { speak, stopSpeaking } from "../tts.js";
import { useVoiceRecorder } from "../useVoiceRecorder.js";
import { MemoriesModal } from "./MemoriesModal.js";

interface Props {
  persona: Persona;
  conversationId: string;
}

const AUTO_SPEAK_KEY = "ai-gf:auto-speak";

const MOTION_TEMPLATES = [
  { label: "None", keywords: "" },
  { label: "Cinematic Zoom", keywords: "slow cinematic zoom in, smooth camera motion" },
  { label: "Slow Pan", keywords: "slow horizontal pan, gentle camera movement" },
  { label: "Dramatic Reveal", keywords: "dramatic reveal, slow motion, particles" },
  { label: "Gentle Sway", keywords: "gentle idle sway, subtle breathing motion, hair movement" },
];

export function ChatWindow({ persona, conversationId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoTemplate, setVideoTemplate] = useState(0);
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem(AUTO_SPEAK_KEY) === "1");
  const [callMode, setCallMode] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [showMemories, setShowMemories] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const callModeRef = useRef(false);

  useEffect(() => {
    callModeRef.current = callMode;
  }, [callMode]);

  const recorder = useVoiceRecorder(async (blob) => {
    try {
      const text = await api.transcribe(blob);
      if (callModeRef.current) {
        if (text.trim()) void sendText(text.trim());
      } else {
        setDraft((prev) => (prev ? `${prev} ${text}` : text));
      }
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

  function toggleCallMode() {
    setCallMode((prev) => {
      const next = !prev;
      if (!next) stopSpeaking();
      return next;
    });
  }

  function speakReply(text: string) {
    if (!autoSpeak && !callMode) return;
    speak(text, persona.voiceURI, () => {
      if (callModeRef.current) recorder.start();
    });
  }

  async function sendText(content: string, images?: string[]) {
    if (!content.trim() && (!images || images.length === 0)) return;
    if (sending) return;

    setError(null);
    setSending(true);
    const localId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: localId, conversationId, role: "user", content, images, createdAt: Date.now() },
    ]);
    setStreamingText("");

    await sendMessageStream(
      conversationId,
      content,
      {
        onUserSaved: (message) => {
          setMessages((prev) => prev.map((m) => (m.id === localId ? message : m)));
        },
        onToken: (chunk) => setStreamingText((prev) => (prev ?? "") + chunk),
        onDone: (message) => {
          setMessages((prev) => [...prev, message]);
          setStreamingText(null);
          setSending(false);
          speakReply(message.content);
        },
        onError: (message) => {
          setError(message);
          setStreamingText(null);
          setSending(false);
        },
      },
      images
    );
  }

  async function handleSend() {
    const content = draft.trim();
    const images = pendingImages.length > 0 ? pendingImages : undefined;
    setDraft("");
    setPendingImages([]);
    await sendText(content, images);
  }

  async function handleRegenerate(messageId: string) {
    setError(null);
    setSending(true);
    setStreamingText("");

    await regenerateMessageStream(conversationId, messageId, {
      onToken: (chunk) => setStreamingText((prev) => (prev ?? "") + chunk),
      onDone: (message) => {
        setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
        setStreamingText(null);
        setSending(false);
        speakReply(message.content);
      },
      onError: (message) => {
        setError(message);
        setStreamingText(null);
        setSending(false);
      },
    });
  }

  async function handleSwipe(messageId: string, direction: "prev" | "next") {
    try {
      const updated = await api.swipeMessage(conversationId, messageId, direction);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swipe failed.");
    }
  }

  function startEdit(message: Message) {
    setEditingId(message.id);
    setEditText(message.content);
  }

  async function saveEdit() {
    if (!editingId) return;
    const id = editingId;
    try {
      const updated = await api.editMessage(conversationId, id, editText);
      setMessages((prev) => prev.map((m) => (m.id === id ? updated : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Edit failed.");
    } finally {
      setEditingId(null);
    }
  }

  async function handleDelete(messageId: string) {
    try {
      await api.deleteMessage(conversationId, messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  async function togglePin(messageId: string) {
    try {
      const updated = await api.togglePin(conversationId, messageId);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pin failed.");
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPendingImages((prev) => [...prev, reader.result as string]);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleGenerateImage() {
    const prompt = draft.trim();
    setDraft("");
    setGeneratingImage(true);
    setError(null);
    try {
      const message = await api.generateImage(conversationId, prompt);
      setMessages((prev) => [...prev, message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed.");
    } finally {
      setGeneratingImage(false);
    }
  }

  async function handleGenerateVideo() {
    const template = MOTION_TEMPLATES[videoTemplate];
    const motionPrompt = [draft.trim(), template.keywords].filter(Boolean).join(", ");
    setDraft("");
    setGeneratingVideo(true);
    setError(null);
    try {
      const message = await api.generateVideo(conversationId, motionPrompt);
      setMessages((prev) => [...prev, message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video generation failed.");
    } finally {
      setGeneratingVideo(false);
    }
  }

  function downloadMedia(message: Message) {
    const dataUri = message.video ?? message.images?.[0];
    if (!dataUri) return;
    const extension = message.video ? "mp4" : "png";
    const a = document.createElement("a");
    a.href = dataUri;
    a.download = `ai-gf-${message.id}.${extension}`;
    a.click();
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

  const visibleMessages = showPinnedOnly ? messages.filter((m) => m.pinned) : messages;
  const lastMessageId = messages[messages.length - 1]?.id;

  return (
    <div className="chat-window">
      <div className="chat-header">
        {persona.avatarImage ? (
          <img src={persona.avatarImage} alt="" className="avatar-img" />
        ) : (
          <span className="avatar-dot" style={{ background: persona.avatarColor }} />
        )}
        <div>
          <div className="chat-title">{persona.name}</div>
          <div className="chat-subtitle">{persona.model}</div>
        </div>
        <div className="chat-header-actions">
          <button
            className={`icon-btn ${showPinnedOnly ? "active" : ""}`}
            onClick={() => setShowPinnedOnly((v) => !v)}
            title="Show pinned messages"
          >
            📌
          </button>
          <button className="icon-btn" onClick={() => setShowMemories(true)} title="View memories">
            🧠
          </button>
          <button
            className={`icon-btn ${callMode ? "active" : ""}`}
            onClick={toggleCallMode}
            title={callMode ? "Voice call mode: on" : "Voice call mode: off"}
          >
            📞
          </button>
          <button
            className={`icon-btn speak-toggle ${autoSpeak ? "active" : ""}`}
            onClick={toggleAutoSpeak}
            title={autoSpeak ? "Auto-speak replies: on" : "Auto-speak replies: off"}
          >
            {autoSpeak ? "🔊" : "🔇"}
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {visibleMessages.map((message) => {
          const isEditing = editingId === message.id;
          const isLatest = message.id === lastMessageId;
          const canRegenerate = isLatest && message.role === "assistant";
          const hasVariants = (message.variants?.length ?? 0) > 1;

          return (
            <div key={message.id} className={`bubble ${message.role}`}>
              {message.images?.map((img, i) => <img key={i} src={img} alt="" className="msg-image" />)}
              {message.video && <video src={message.video} controls loop className="msg-video" />}

              {isEditing ? (
                <div className="msg-edit">
                  <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} autoFocus />
                  <div className="msg-edit-actions">
                    <button onClick={() => setEditingId(null)}>Cancel</button>
                    <button className="primary" onClick={saveEdit}>
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                message.content && <div className="msg-text">{renderMarkdown(message.content)}</div>
              )}

              {!isEditing && (
                <div className="msg-actions">
                  {message.role === "assistant" && (
                    <button className="msg-action-btn" onClick={() => speak(message.content, persona.voiceURI)} title="Read aloud">
                      🔊
                    </button>
                  )}
                  {(message.video || message.images?.length) && (
                    <button className="msg-action-btn" onClick={() => downloadMedia(message)} title="Download">
                      ⬇
                    </button>
                  )}
                  <button
                    className={`msg-action-btn ${message.pinned ? "active" : ""}`}
                    onClick={() => togglePin(message.id)}
                    title={message.pinned ? "Unpin" : "Pin"}
                  >
                    {message.pinned ? "★" : "☆"}
                  </button>
                  <button className="msg-action-btn" onClick={() => startEdit(message)} title="Edit">
                    ✎
                  </button>
                  <button className="msg-action-btn" onClick={() => handleDelete(message.id)} title="Delete">
                    🗑
                  </button>
                  {hasVariants && (
                    <>
                      <button className="msg-action-btn" onClick={() => handleSwipe(message.id, "prev")} title="Previous reply">
                        ◀
                      </button>
                      <span className="msg-variant-count">
                        {(message.activeVariantIndex ?? 0) + 1}/{message.variants?.length}
                      </span>
                      <button className="msg-action-btn" onClick={() => handleSwipe(message.id, "next")} title="Next reply">
                        ▶
                      </button>
                    </>
                  )}
                  {canRegenerate && (
                    <button className="msg-action-btn" onClick={() => handleRegenerate(message.id)} title="Regenerate">
                      🔄
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {streamingText !== null && <div className="bubble assistant">{renderMarkdown(streamingText || "…")}</div>}
        {generatingImage && <div className="bubble assistant">*generating a photo…* 📷</div>}
        {generatingVideo && <div className="bubble assistant">*animating a video, this can take a while…* 🎬</div>}
        {error && <div className="bubble error">{error}</div>}
        {recorder.error && <div className="bubble error">{recorder.error}</div>}
        <div ref={bottomRef} />
      </div>

      {pendingImages.length > 0 && (
        <div className="pending-images">
          {pendingImages.map((img, i) => (
            <div key={i} className="pending-image">
              <img src={img} alt="" />
              <button onClick={() => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}>×</button>
            </div>
          ))}
        </div>
      )}

      <div className="chat-input">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={handleFileSelected}
        />
        <button className="icon-btn attach-btn" onClick={() => fileInputRef.current?.click()} title="Attach a photo">
          📎
        </button>
        <button className="icon-btn attach-btn" onClick={handleGenerateImage} disabled={generatingImage} title="Generate a selfie">
          📷
        </button>
        <select
          className="video-template-select"
          value={videoTemplate}
          onChange={(e) => setVideoTemplate(Number(e.target.value))}
          title="Motion template"
        >
          {MOTION_TEMPLATES.map((t, i) => (
            <option key={t.label} value={i}>
              {t.label}
            </option>
          ))}
        </select>
        <button className="icon-btn attach-btn" onClick={handleGenerateVideo} disabled={generatingVideo} title="Animate into a video">
          🎬
        </button>
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
        <button onClick={handleSend} disabled={sending || (!draft.trim() && pendingImages.length === 0)}>
          Send
        </button>
      </div>

      {showMemories && <MemoriesModal persona={persona} onClose={() => setShowMemories(false)} />}
    </div>
  );
}
