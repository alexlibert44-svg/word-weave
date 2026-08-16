/**
 * Browser speech helpers. Real speech recognition is used when the browser
 * supports it; otherwise the speaking exercise falls back to a self-check so
 * the flow never dead-ends. A server-side pronunciation assessor can replace
 * `listenOnce` later without touching the UI.
 */

export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
}

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w["SpeechRecognition"] ?? w["webkitSpeechRecognition"]);
}

type RecognitionHandle = { stop: () => void };

export function listenOnce(
  onResult: (transcript: string) => void,
  onError: (message: string) => void,
): RecognitionHandle | null {
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"]) as
    | (new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        start: () => void;
        stop: () => void;
        onresult: ((event: unknown) => void) | null;
        onerror: ((event: unknown) => void) | null;
      })
    | undefined;
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event: unknown) => {
    const results = (event as { results: { 0: { 0: { transcript: string } } } }).results;
    onResult(results[0][0].transcript);
  };
  recognition.onerror = () => onError("We couldn't hear that clearly.");
  recognition.start();
  return { stop: () => recognition.stop() };
}
