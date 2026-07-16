import { useRef } from "react";
import type { Conversation, Persona } from "../api.js";

interface Props {
  personas: Persona[];
  selectedPersonaId: string | null;
  onSelectPersona: (id: string) => void;
  onNewPersona: () => void;
  onEditPersona: (persona: Persona) => void;
  onDeletePersona: (id: string) => void;
  onExportPersona: (persona: Persona) => void;
  onImportPersona: (file: File) => void;

  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;

  modelsError: string | null;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({
  personas,
  selectedPersonaId,
  onSelectPersona,
  onNewPersona,
  onEditPersona,
  onDeletePersona,
  onExportPersona,
  onImportPersona,
  conversations,
  selectedConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  modelsError,
  onOpenSearch,
  onOpenSettings,
  mobileOpen,
  onMobileClose,
}: Props) {
  const importInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onMobileClose} />}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="app-bar">
          <span className="app-title">AI-GF</span>
          <button className="icon-btn" onClick={onOpenSearch} title="Search conversations">
            🔍
          </button>
        </div>

      <div className="sidebar-section">
        <div className="sidebar-header">
          <span>Characters</span>
          <span>
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              className="visually-hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportPersona(file);
                e.target.value = "";
              }}
            />
            <button className="icon-btn" onClick={() => importInputRef.current?.click()} title="Import character card">
              ⇪
            </button>
            <button className="icon-btn" onClick={onNewPersona} title="New character">
              +
            </button>
          </span>
        </div>
        {modelsError && <p className="warning">Ollama unreachable: {modelsError}</p>}
        <ul className="list">
          {personas.map((persona) => (
            <li
              key={persona.id}
              className={`list-item ${persona.id === selectedPersonaId ? "active" : ""}`}
              onClick={() => onSelectPersona(persona.id)}
            >
              {persona.avatarImage ? (
                <img src={persona.avatarImage} alt="" className="avatar-img small" />
              ) : (
                <span className="avatar-dot" style={{ background: persona.avatarColor }} />
              )}
              <span className="list-item-label">{persona.name}</span>
              <span className="list-item-actions">
                <button
                  className="icon-btn small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExportPersona(persona);
                  }}
                  title="Export character card"
                >
                  ⇩
                </button>
                <button
                  className="icon-btn small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPersona(persona);
                  }}
                  title="Edit"
                >
                  ✎
                </button>
                <button
                  className="icon-btn small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete ${persona.name} and all their conversations?`)) {
                      onDeletePersona(persona.id);
                    }
                  }}
                  title="Delete"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
          {personas.length === 0 && <li className="hint">No characters yet — click + to create one.</li>}
        </ul>
      </div>

      {selectedPersonaId && (
        <div className="sidebar-section">
          <div className="sidebar-header">
            <span>Conversations</span>
            <button className="icon-btn" onClick={onNewConversation} title="New conversation">
              +
            </button>
          </div>
          <ul className="list">
            {conversations.map((conversation) => (
              <li
                key={conversation.id}
                className={`list-item ${conversation.id === selectedConversationId ? "active" : ""}`}
                onClick={() => onSelectConversation(conversation.id)}
              >
                <span className="list-item-label">{conversation.title}</span>
                <span className="list-item-actions">
                  <button
                    className="icon-btn small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conversation.id);
                    }}
                    title="Delete"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
            {conversations.length === 0 && <li className="hint">No conversations yet.</li>}
          </ul>
        </div>
      )}

        <div className="sidebar-footer">
          <button className="icon-btn" onClick={onOpenSettings} title="Settings">
            ⚙ Settings
          </button>
        </div>
      </aside>
    </>
  );
}
