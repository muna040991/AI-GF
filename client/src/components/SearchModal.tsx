import { useEffect, useState } from "react";
import { api, type SearchResult } from "../api.js";

interface Props {
  onClose: () => void;
  onNavigate: (personaId: string, conversationId: string) => void;
}

export function SearchModal({ onClose, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      api
        .search(q)
        .then(setResults)
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal search-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Search conversations</h3>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search everything you've said…"
          autoFocus
        />

        <div className="search-results">
          {searching && <p className="hint">Searching…</p>}
          {!searching && query.trim() && results.length === 0 && <p className="hint">No matches.</p>}
          {results.map((r) => (
            <div
              key={r.message.id}
              className="search-result"
              onClick={() => {
                onNavigate(r.personaId, r.conversationId);
                onClose();
              }}
            >
              <div className="search-result-meta">
                {r.personaName} · {r.conversationTitle}
              </div>
              <div className="search-result-snippet">{r.message.content.slice(0, 160)}</div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
