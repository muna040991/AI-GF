import { Router } from "express";
import { BackupError, exportEncryptedBackup, importEncryptedBackup } from "../backup.js";

export const backupRouter = Router();

backupRouter.post("/export", (req, res) => {
  const passphrase: string = req.body?.passphrase ?? "";
  if (!passphrase || passphrase.length < 4) {
    res.status(400).json({ error: "Passphrase must be at least 4 characters." });
    return;
  }
  res.json(exportEncryptedBackup(passphrase));
});

backupRouter.post("/import", (req, res) => {
  const passphrase: string = req.body?.passphrase ?? "";
  const envelope = req.body?.envelope;
  try {
    importEncryptedBackup(passphrase, envelope);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof BackupError ? err.message : "Import failed.";
    res.status(400).json({ error: message });
  }
});
