import { useEffect, useRef, useState } from "react";
import { api, type Conversation, type OllamaModel, type Persona } from "./api.js";
import { ChatWindow } from "./components/ChatWindow.js";
import { PersonaEditor } from "./components/PersonaEditor.js";
import { SearchModal } from "./components/SearchModal.js";
import { SettingsModal } from "./components/SettingsModal.js";
import { Sidebar } from "./components/Sidebar.js";

export default function App() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const pendingConversationId = useRef<string | null>(null);

  const [editingPersona, setEditingPersona] = useState<Persona | "new" | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    api.listPersonas().then((list) => {
      setPersonas(list);
      if (list.length > 0) setSelectedPersonaId(list[0].id);
    });
    api
      .listModels()
      .then(setModels)
      .catch((err) => setModelsError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedPersonaId) {
      setConversations([]);
      setSelectedConversationId(null);
      return;
    }
    api.listConversations(selectedPersonaId).then((list) => {
      setConversations(list);
      const desired = pendingConversationId.current;
      pendingConversationId.current = null;
      if (desired && list.some((c) => c.id === desired)) {
        setSelectedConversationId(desired);
      } else {
        setSelectedConversationId(list[0]?.id ?? null);
      }
    });
  }, [selectedPersonaId]);

  const selectedPersona = personas.find((p) => p.id === selectedPersonaId) ?? null;

  async function handleNewConversation() {
    if (!selectedPersonaId) return;
    const conversation = await api.createConversation(selectedPersonaId, "New conversation");
    setConversations((prev) => [conversation, ...prev]);
    setSelectedConversationId(conversation.id);
  }

  async function handleDeleteConversation(id: string) {
    await api.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (selectedConversationId === id) {
      setSelectedConversationId(null);
    }
  }

  async function handleSavePersona(data: Omit<Persona, "id" | "createdAt">, editing: Persona | "new") {
    if (editing === "new") {
      const persona = await api.createPersona(data);
      setPersonas((prev) => [...prev, persona]);
      setSelectedPersonaId(persona.id);
    } else {
      const persona = await api.updatePersona(editing.id, data);
      setPersonas((prev) => prev.map((p) => (p.id === persona.id ? persona : p)));
    }
    setEditingPersona(null);
  }

  async function handleDeletePersona(id: string) {
    await api.deletePersona(id);
    setPersonas((prev) => prev.filter((p) => p.id !== id));
    if (selectedPersonaId === id) setSelectedPersonaId(null);
  }

  function handleNavigateToMessage(personaId: string, conversationId: string) {
    if (personaId === selectedPersonaId) {
      setSelectedConversationId(conversationId);
    } else {
      pendingConversationId.current = conversationId;
      setSelectedPersonaId(personaId);
    }
  }

  async function handleExportPersona(persona: Persona) {
    const card = await api.exportPersona(persona.id);
    const blob = new Blob([JSON.stringify(card, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${persona.name.toLowerCase().replace(/\s+/g, "-")}.card.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportPersona(file: File) {
    setError(null);
    try {
      const text = await file.text();
      const card = JSON.parse(text);
      const persona = await api.importPersona(card);
      setPersonas((prev) => [...prev, persona]);
      setSelectedPersonaId(persona.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import that character card.");
    }
  }

  return (
    <div className="app">
      <Sidebar
        personas={personas}
        selectedPersonaId={selectedPersonaId}
        onSelectPersona={(id) => {
          setSelectedPersonaId(id);
          setMobileSidebarOpen(false);
        }}
        onNewPersona={() => setEditingPersona("new")}
        onEditPersona={(p) => setEditingPersona(p)}
        onDeletePersona={handleDeletePersona}
        onExportPersona={handleExportPersona}
        onImportPersona={handleImportPersona}
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={(id) => {
          setSelectedConversationId(id);
          setMobileSidebarOpen(false);
        }}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        modelsError={modelsError}
        onOpenSearch={() => setShowSearch(true)}
        onOpenSettings={() => setShowSettings(true)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <main className="main">
        <button className="mobile-menu-btn" onClick={() => setMobileSidebarOpen(true)} title="Menu">
          ☰
        </button>
        {error && <div className="toast-error">{error}</div>}
        {selectedPersona && selectedConversationId ? (
          <ChatWindow key={selectedConversationId} persona={selectedPersona} conversationId={selectedConversationId} />
        ) : (
          <div className="empty-state">
            <h2>AI-GF</h2>
            <p>Fully offline, local-only chat. No cloud calls, ever.</p>
            <p>
              {personas.length === 0
                ? "Create a character to get started."
                : "Pick a character and start a new conversation."}
            </p>
          </div>
        )}
      </main>
      {editingPersona !== null && (
        <PersonaEditor
          persona={editingPersona === "new" ? null : editingPersona}
          availableModels={models}
          onCancel={() => setEditingPersona(null)}
          onSave={(data) => handleSavePersona(data, editingPersona)}
        />
      )}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} onNavigate={handleNavigateToMessage} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
