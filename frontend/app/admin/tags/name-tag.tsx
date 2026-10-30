"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import type { NameTag, TagSection } from "@/lib/admin-api";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ifysummit.com";
// Served as a download (see next.config.ts headers()).
export const AGENDA_URL = `${SITE_URL}/agenda.pdf`;

// Tab dot colour per section on the admin page (the stickers themselves
// are black-only, for thermal label printers).
export const SECTION_COLORS: Record<TagSection, string> = {
  registrants: "#093c2f", // forest
  speakers: "#e8734a", // coral
  sponsors: "#b98a46", // gold
  committee: "#53776d", // sage
  vips: "#a95641", // rust
};

// One label from a label-printer roll, stuck onto the pre-printed badge
// card. Laid out in millimetres so the printed size is exact regardless of
// screen DPI.
const STICKER_WIDTH_MM = 90;
const STICKER_HEIGHT_MM = 40;

// The name shares the width with the QR, so it steps down sooner.
function nameFontSizeMm(name: string): number {
  if (name.length <= 12) return 7;
  if (name.length <= 18) return 6;
  if (name.length <= 26) return 5;
  return 4.4;
}

// Same QR on every sticker, so it's encoded once and shared.
export function useAgendaQr(): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void QRCode.toString(AGENDA_URL, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    }).then((svg) => {
      if (!cancelled) {
        setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return src;
}

export function NameTagCard({ tag, qrSrc }: { tag: NameTag; qrSrc: string | null }) {
  return (
    <div
      className="name-tag"
      style={{
        width: `${STICKER_WIDTH_MM}mm`,
        height: `${STICKER_HEIGHT_MM}mm`,
        boxSizing: "border-box",
        padding: "4mm",
        background: "#ffffff",
        color: "#000000",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        gap: "4mm",
        textAlign: "left",
        fontFamily: "var(--font-inter), Arial, sans-serif",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-bricolage-grotesque), Arial, sans-serif",
            fontWeight: 800,
            fontSize: `${nameFontSizeMm(tag.name)}mm`,
            lineHeight: 1.05,
            overflowWrap: "anywhere",
          }}
        >
          {tag.name}
        </p>
        {tag.title && (
          <p style={{ margin: "2mm 0 0", fontSize: "3.8mm", lineHeight: 1.2, fontWeight: 600 }}>{tag.title}</p>
        )}
        {tag.organization && (
          <p style={{ margin: "0.8mm 0 0", fontSize: "3.3mm", lineHeight: 1.2 }}>{tag.organization}</p>
        )}
      </div>
      <div style={{ width: "24mm", flexShrink: 0, textAlign: "center" }}>
        {qrSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrSrc} alt="Scan for the agenda" style={{ width: "24mm", height: "24mm", display: "block" }} />
        ) : (
          <div style={{ width: "24mm", height: "24mm" }} />
        )}
        <p
          style={{
            margin: "1.2mm 0 0",
            fontSize: "2.6mm",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            lineHeight: 1.1,
          }}
        >
          Scan for agenda
        </p>
      </div>
    </div>
  );
}

// Screen preview — the real mm-sized sticker, scaled down.
export function NameTagPreview({
  tag,
  qrSrc,
  scale = 0.65,
}: {
  tag: NameTag;
  qrSrc: string | null;
  scale?: number;
}) {
  return (
    <div
      style={{
        width: `calc(${STICKER_WIDTH_MM}mm * ${scale})`,
        height: `calc(${STICKER_HEIGHT_MM}mm * ${scale})`,
        overflow: "hidden",
      }}
      className="rounded-lg shadow-sm border border-emerald/20 bg-white"
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <NameTagCard tag={tag} qrSrc={qrSrc} />
      </div>
    </div>
  );
}

const PRINT_ROOT_ID = "name-tag-print";

// Full-size stickers, one per label-sized page. Rendered straight under
// <body> so the print stylesheet can hide everything else (the admin shell
// included). Only rendered after a Print click, so `document` is always
// available.
export function NameTagPrintSheet({ tags, qrSrc }: { tags: NameTag[]; qrSrc: string | null }) {
  return createPortal(
    <div id={PRINT_ROOT_ID}>
      <style>{`
        @page { size: ${STICKER_WIDTH_MM}mm ${STICKER_HEIGHT_MM}mm; margin: 0; }
        #${PRINT_ROOT_ID} { display: none; }
        @media print {
          html, body { background: #ffffff !important; margin: 0 !important; }
          body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
          #${PRINT_ROOT_ID} { display: block; }
          #${PRINT_ROOT_ID} .name-tag { break-after: page; page-break-after: always; }
          #${PRINT_ROOT_ID} .name-tag:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
      {tags.map((tag) => (
        <NameTagCard key={tag.id} tag={tag} qrSrc={qrSrc} />
      ))}
    </div>,
    document.body,
  );
}

// Waits for the QR on every sticker in the print sheet to finish loading,
// so the browser never prints a blank image.
export async function printNameTags() {
  const root = document.getElementById(PRINT_ROOT_ID);
  if (!root) return;
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : img.decode().catch(() => undefined),
    ),
  );
  window.print();
}
