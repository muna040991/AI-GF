import { useEffect, useState } from "react";
import { api, type Conversation, type OllamaModel, type Persona } from "./api.js";
import { ChatWindow } from "./components/ChatWindow.js";
import { PersonaEditor } from "./components/PersonaEditor.js";
import { Sidebar } from "./components/Sidebar.js";

export default function App() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const [editingPersona, setEditingPersona] = useState<Persona | "new" | null>(null);

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
      setSelectedConversationId(list[0]?.id ?? null);
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

  return (
    <div className="app">
      <Sidebar
        personas={personas}
        selectedPersonaId={selectedPersonaId}
        onSelectPersona={setSelectedPersonaId}
        onNewPersona={() => setEditingPersona("new")}
        onEditPersona={(p) => setEditingPersona(p)}
        onDeletePersona={handleDeletePersona}
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        modelsError={modelsError}
      />
      <main className="main">
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
    </div>
  );
}
