import { useState } from "react";
import { api } from "../api.js";
import { applyTheme, getStoredTheme, type Theme } from "../theme.js";

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const [theme, setTheme] = useState<Theme>(getStoredTheme());
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleThemeChange(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  async function handleExport() {
    if (exportPassphrase.length < 4) {
      setStatus("Passphrase must be at least 4 characters.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const envelope = await api.exportBackup(exportPassphrase);
      const blob = new Blob([JSON.stringify(envelope)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-gf-backup-${new Date().toISOString().slice(0, 10)}.agf.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Backup downloaded.");
      setExportPassphrase("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!importFile) {
      setStatus("Choose a backup file first.");
      return;
    }
    if (!importPassphrase) {
      setStatus("Enter the backup's passphrase.");
      return;
    }
    if (!confirm("This replaces ALL current characters and conversations with the backup. Continue?")) return;

    setBusy(true);
    setStatus(null);
    try {
      const text = await importFile.text();
      const envelope = JSON.parse(text);
      await api.importBackup(importPassphrase, envelope);
      setStatus("Backup restored. Reloading…");
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Settings</h3>

        <section className="settings-section">
          <h4>Theme</h4>
          <div className="theme-row">
            <button className={theme === "dark" ? "primary" : ""} onClick={() => handleThemeChange("dark")}>
              Dark
            </button>
            <button className={theme === "light" ? "primary" : ""} onClick={() => handleThemeChange("light")}>
              Light
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h4>Export encrypted backup</h4>
          <p className="hint">Downloads everything — characters, conversations, memories — encrypted with a passphrase.</p>
          <div className="backup-row">
            <input
              type="password"
              value={exportPassphrase}
              onChange={(e) => setExportPassphrase(e.target.value)}
              placeholder="Choose a passphrase"
            />
            <button className="primary" onClick={handleExport} disabled={busy}>
              Export
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h4>Restore from backup</h4>
          <p className="hint">Replaces everything currently in the app with the backup's contents.</p>
          <input type="file" accept=".json" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
          <div className="backup-row">
            <input
              type="password"
              value={importPassphrase}
              onChange={(e) => setImportPassphrase(e.target.value)}
              placeholder="Backup passphrase"
            />
            <button onClick={handleImport} disabled={busy}>
              Restore
            </button>
          </div>
        </section>

        {status && <p className="hint">{status}</p>}

        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
