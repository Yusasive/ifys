export type FeedbackKind = "success" | "warning" | "error";

const VIBRATION: Record<FeedbackKind, number[]> = {
  success: [80],
  warning: [60, 60, 60],
  error: [250, 100, 250],
};

// Frequency (Hz) and duration (ms) of each beep, in order.
const TONES: Record<FeedbackKind, [number, number][]> = {
  success: [[880, 120]],
  warning: [[660, 120], [660, 120]],
  error: [[220, 350]],
};

let audioCtx: AudioContext | null = null;

// Browsers only allow audio after a user gesture; call this from the tap that
// starts scanning.
export function primeFeedback() {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
  } catch {
    // Audio is a nicety; scanning works without it.
  }
}

/** Vibrates and beeps so staff can tell the result without looking. */
export function signalResult(kind: FeedbackKind) {
  try {
    navigator.vibrate?.(VIBRATION[kind]);
  } catch {
    // unsupported
  }
  try {
    if (!audioCtx) return;
    let at = audioCtx.currentTime;
    for (const [frequency, ms] of TONES[kind]) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = frequency;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(at);
      osc.stop(at + ms / 1000);
      at += ms / 1000 + 0.06;
    }
  } catch {
    // unsupported
  }
}
