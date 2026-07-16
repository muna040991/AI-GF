import { useEffect, useState } from "react";
import { api, type Memory, type Persona } from "../api.js";

interface Props {
  persona: Persona;
  onClose: () => void;
}

export function MemoriesModal({ persona, onClose }: Props) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listMemories(persona.id)
      .then(setMemories)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load memories."))
      .finally(() => setLoading(false));
  }, [persona.id]);

  async function handleAdd() {
    const content = newContent.trim();
    if (!content) return;
    setError(null);
    try {
      const memory = await api.addMemory(persona.id, content);
      setMemories((prev) => [memory, ...prev]);
      setNewContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that memory.");
    }
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    const content = editText.trim();
    if (!content) return;
    setError(null);
    try {
      const updated = await api.editMemory(editingId, content);
      setMemories((prev) => prev.map((m) => (m.id === editingId ? updated : m)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that edit.");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await api.deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that memory.");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal memories-modal" onClick={(e) => e.stopPropagation()}>
        <h3>What {persona.name} remembers about you</h3>

        <div className="memory-add-row">
          <input
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Add something for her to remember…"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button className="primary" onClick={handleAdd}>
            Add
          </button>
        </div>

        {error && <p className="hint form-error">{error}</p>}

        <div className="memory-list">
          {loading && <p className="hint">Loading…</p>}
          {!loading && memories.length === 0 && <p className="hint">No memories yet.</p>}
          {memories.map((memory) => (
            <div key={memory.id} className="memory-item">
              {editingId === memory.id ? (
                <>
                  <input value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus />
                  <button onClick={handleSaveEdit}>Save</button>
                  <button onClick={() => setEditingId(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span className="memory-text">{memory.content}</span>
                  <button
                    className="icon-btn small"
                    onClick={() => {
                      setEditingId(memory.id);
                      setEditText(memory.content);
                    }}
                    title="Edit"
                  >
                    ✎
                  </button>
                  <button className="icon-btn small" onClick={() => handleDelete(memory.id)} title="Delete">
                    ×
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
