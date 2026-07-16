// Wraps the browser's built-in speech synthesis, which runs entirely
// on-device (OS/browser voices) — unlike speech *recognition*, it never
// sends anything over the network.

export function speak(text: string, voiceURI?: string, onEnd?: () => void) {
  if (!("speechSynthesis" in window) || !text.trim()) {
    onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  if (voiceURI) {
    const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceURI);
    if (voice) utterance.voice = voice;
  }
  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function isSpeechSynthesisSupported(): boolean {
  return "speechSynthesis" in window;
}

/**
 * Voice lists load asynchronously in some browsers, so this resolves
 * once at least one voice is available (or immediately if already loaded).
 */
export function getVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!("speechSynthesis" in window)) return Promise.resolve([]);

  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);

  return new Promise((resolve) => {
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };
  });
}
