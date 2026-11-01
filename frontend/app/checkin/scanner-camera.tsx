"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

// ~10 reads a second is plenty for a QR held up to the camera, and far
// cheaper than decoding on every display frame.
const SCAN_INTERVAL_MS = 100;
// jsQR cost grows with pixel count; a QR stays readable well below the
// camera's native resolution.
const MAX_DECODE_WIDTH = 640;

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
interface BarcodeDetectorCtor {
  new (options: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
}

// Torch isn't in the standard DOM typings yet.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

export function ScannerCamera({
  paused,
  onDetect,
}: {
  paused: boolean;
  onDetect: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const pausedRef = useRef(paused);
  const onDetectRef = useRef(onDetect);

  useEffect(() => {
    pausedRef.current = paused;
    onDetectRef.current = onDetect;
  }, [paused, onDetect]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frameHandle = 0;
    let cancelled = false;
    let lastRun = 0;
    let detecting = false;
    let detector: BarcodeDetectorLike | null = null;

    async function createDetector() {
      const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
        .BarcodeDetector;
      if (!Ctor) return null;
      try {
        const formats = await Ctor.getSupportedFormats();
        return formats.includes("qr_code") ? new Ctor({ formats: ["qr_code"] }) : null;
      } catch {
        return null;
      }
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const track = stream.getVideoTracks()[0];
        trackRef.current = track ?? null;
        const capabilities = track?.getCapabilities?.() as TorchCapabilities | undefined;
        if (capabilities?.torch) setTorchSupported(true);

        detector = await createDetector();
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick(performance.now());
      } catch {
        if (!cancelled) {
          setCameraError("Camera unavailable. Use the code field below instead.");
        }
      }
    }

    async function decode(video: HTMLVideoElement): Promise<string | null> {
      if (detector) {
        const found = await detector.detect(video);
        return found[0]?.rawValue ?? null;
      }
      const canvas = canvasRef.current;
      if (!canvas || !video.videoWidth) return null;
      const scale = Math.min(1, MAX_DECODE_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return (
        jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ??
        null
      );
    }

    function tick(now: number) {
      frameHandle = requestAnimationFrame(tick);
      const video = videoRef.current;
      if (
        detecting ||
        pausedRef.current ||
        now - lastRun < SCAN_INTERVAL_MS ||
        !video ||
        video.readyState !== video.HAVE_ENOUGH_DATA
      ) {
        return;
      }
      lastRun = now;
      detecting = true;
      decode(video)
        .then((text) => {
          if (text && !cancelled && !pausedRef.current) onDetectRef.current(text);
        })
        .catch(() => {
          // A failed read is just a missed frame.
        })
        .finally(() => {
          detecting = false;
        });
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameHandle);
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
    };
  }, []);

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }

  return (
    <div className="relative w-full aspect-square max-w-md mx-auto bg-ink rounded-[20px] overflow-hidden border border-rust/30">
      <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />
      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-paper bg-ink">
          {cameraError}
        </div>
      )}
      <div className="absolute inset-6 border-2 border-salmon rounded-[16px] pointer-events-none" />
      {torchSupported && (
        <button
          type="button"
          onClick={() => void toggleTorch()}
          aria-pressed={torchOn}
          className="absolute bottom-3 right-3 rounded-full bg-black/60 text-white text-xs font-medium px-3 py-1.5"
        >
          {torchOn ? "Torch on" : "Torch off"}
        </button>
      )}
    </div>
  );
}
