"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

export function ScannerCamera({
  paused,
  onDetect,
}: {
  paused: boolean;
  onDetect: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frameHandle: number;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch {
        if (!cancelled) {
          setCameraError(
            "Camera unavailable — use the code field below instead.",
          );
        }
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          if (!pausedRef.current) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code?.data) {
              onDetect(code.data);
            }
          }
        }
      }
      frameHandle = requestAnimationFrame(tick);
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameHandle);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full aspect-square max-w-md mx-auto bg-neutral-900 rounded-sm overflow-hidden">
      <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />
      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-neutral-300 bg-neutral-900">
          {cameraError}
        </div>
      )}
      <div className="absolute inset-6 border-2 border-gold-light rounded-sm pointer-events-none" />
    </div>
  );
}
