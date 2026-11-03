"use client";

import { useEffect, useState, type ReactElement } from "react";
import { flushSync } from "react-dom";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import QRCode from "qrcode";
import { toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
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

export type PrintLayout = "label" | "a4" | "a3";

// Stickers are packed edge to edge, so the grid is centred on the page and
// the leftover becomes the margin (at least 5mm, which office printers need).
const SHEETS = {
  a4: { name: "A4", pageWidthMm: 297, pageHeightMm: 210, columns: 3, rows: 5 },
  a3: { name: "A3", pageWidthMm: 297, pageHeightMm: 420, columns: 3, rows: 10 },
} as const;

export const PRINT_LAYOUTS: { key: PrintLayout; label: string }[] = [
  { key: "label", label: "Label printer (one per label)" },
  { key: "a4", label: `A4 sheets (${SHEETS.a4.columns * SHEETS.a4.rows} per page)` },
  { key: "a3", label: `A3 sheets (${SHEETS.a3.columns * SHEETS.a3.rows} per page)` },
];

// Full-size stickers. Rendered straight under <body> so the print stylesheet
// can hide everything else (the admin shell included). Only rendered after a
// Print click, so `document` is always available.
export function NameTagPrintSheet({
  tags,
  qrSrc,
  layout,
}: {
  tags: NameTag[];
  qrSrc: string | null;
  layout: PrintLayout;
}) {
  const sheet = layout === "label" ? null : SHEETS[layout];
  const perPage = sheet ? sheet.columns * sheet.rows : 1;
  const pages: NameTag[][] = [];
  for (let i = 0; i < tags.length; i += perPage) pages.push(tags.slice(i, i + perPage));

  return createPortal(
    <div id={PRINT_ROOT_ID}>
      <style>{
        sheet
          ? `
        @page { size: ${sheet.pageWidthMm}mm ${sheet.pageHeightMm}mm; margin: 0; }
        #${PRINT_ROOT_ID} { display: none; }
        @media print {
          html, body { background: #ffffff !important; margin: 0 !important; }
          body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
          #${PRINT_ROOT_ID} { display: block; }
          #${PRINT_ROOT_ID} .tag-page {
            width: ${sheet.pageWidthMm}mm;
            height: ${sheet.pageHeightMm}mm;
            display: grid;
            grid-template-columns: repeat(${sheet.columns}, ${STICKER_WIDTH_MM}mm);
            grid-auto-rows: ${STICKER_HEIGHT_MM}mm;
            justify-content: center;
            align-content: center;
            overflow: hidden;
            break-after: page;
            page-break-after: always;
          }
          #${PRINT_ROOT_ID} .tag-page:last-child { break-after: auto; page-break-after: auto; }
          /* Hairline cut guide around each sticker */
          #${PRINT_ROOT_ID} .name-tag { outline: 0.1mm solid #9ca3af; outline-offset: -0.05mm; }
        }
      `
          : `
        @page { size: ${STICKER_WIDTH_MM}mm ${STICKER_HEIGHT_MM}mm; margin: 0; }
        #${PRINT_ROOT_ID} { display: none; }
        @media print {
          html, body { background: #ffffff !important; margin: 0 !important; }
          body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
          #${PRINT_ROOT_ID} { display: block; }
          #${PRINT_ROOT_ID} .name-tag { break-after: page; page-break-after: always; }
          #${PRINT_ROOT_ID} .name-tag:last-child { break-after: auto; page-break-after: auto; }
        }
      `
      }</style>
      {sheet
        ? pages.map((page, i) => (
            <div key={i} className="tag-page">
              {page.map((tag) => (
                <NameTagCard key={tag.id} tag={tag} qrSrc={qrSrc} />
              ))}
            </div>
          ))
        : tags.map((tag) => <NameTagCard key={tag.id} tag={tag} qrSrc={qrSrc} />)}
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

export type DownloadFormat = "png" | "jpeg" | "pdf";

export const DOWNLOAD_FORMATS: { key: DownloadFormat; label: string }[] = [
  { key: "png", label: "PNG" },
  { key: "jpeg", label: "JPEG" },
  { key: "pdf", label: "PDF" },
];

// 96 CSS px per inch. Single stickers render at 300 DPI; a full A3 page at
// 300 DPI would exceed Safari's canvas size limit, so sheets use 250 DPI.
const TAG_PIXEL_RATIO = 300 / 96;
const SHEET_PIXEL_RATIO = 250 / 96;
const JPEG_QUALITY = 0.95;

type Unit = { node: ReactElement; widthMm: number; heightMm: number; pixelRatio: number };

// One A4/A3 page of stickers, laid out like the print sheet.
function SheetPage({
  sheet,
  tags,
  qrSrc,
}: {
  sheet: (typeof SHEETS)[Exclude<PrintLayout, "label">];
  tags: NameTag[];
  qrSrc: string | null;
}) {
  return (
    <div
      style={{
        width: `${sheet.pageWidthMm}mm`,
        height: `${sheet.pageHeightMm}mm`,
        background: "#ffffff",
        display: "grid",
        gridTemplateColumns: `repeat(${sheet.columns}, ${STICKER_WIDTH_MM}mm)`,
        gridAutoRows: `${STICKER_HEIGHT_MM}mm`,
        justifyContent: "center",
        alignContent: "center",
        overflow: "hidden",
      }}
    >
      {tags.map((tag) => (
        <div key={tag.id} style={{ outline: "0.1mm solid #9ca3af", outlineOffset: "-0.05mm" }}>
          <NameTagCard tag={tag} qrSrc={qrSrc} />
        </div>
      ))}
    </div>
  );
}

function fileSafe(name: string): string {
  return name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "tag";
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Renders a node offscreen at its real size and returns it as a canvas.
async function renderToCanvas(unit: Unit): Promise<HTMLCanvasElement> {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;pointer-events:none;";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(unit.node));
    const el = host.firstElementChild as HTMLElement;
    await document.fonts.ready;
    await Promise.all(
      Array.from(el.querySelectorAll("img")).map((img) =>
        img.complete ? Promise.resolve() : img.decode().catch(() => undefined),
      ),
    );
    return await toCanvas(el, { pixelRatio: unit.pixelRatio, backgroundColor: "#ffffff" });
  } finally {
    root.unmount();
    host.remove();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image."))),
      type,
      JPEG_QUALITY,
    );
  });
}

// Label layout: one image per tag. A4/A3: one image per full page.
// A single file downloads directly; several come as a zip, except PDF,
// which is always one multi-page document.
export async function downloadNameTags(
  tags: NameTag[],
  qrSrc: string | null,
  layout: PrintLayout,
  format: DownloadFormat,
) {
  if (tags.length === 0) return;

  const units: (Unit & { name: string })[] = [];
  if (layout === "label") {
    for (const tag of tags) {
      units.push({
        node: <NameTagCard tag={tag} qrSrc={qrSrc} />,
        widthMm: STICKER_WIDTH_MM,
        heightMm: STICKER_HEIGHT_MM,
        pixelRatio: TAG_PIXEL_RATIO,
        name: fileSafe(tag.name),
      });
    }
  } else {
    const sheet = SHEETS[layout];
    const perPage = sheet.columns * sheet.rows;
    for (let i = 0; i < tags.length; i += perPage) {
      units.push({
        node: <SheetPage sheet={sheet} tags={tags.slice(i, i + perPage)} qrSrc={qrSrc} />,
        widthMm: sheet.pageWidthMm,
        heightMm: sheet.pageHeightMm,
        pixelRatio: SHEET_PIXEL_RATIO,
        name: `${sheet.name.toLowerCase()}-sheet-${units.length + 1}`,
      });
    }
  }

  const baseName =
    layout === "label" ? (tags.length === 1 ? units[0].name : "name-tags") : `name-tags-${layout}`;

  if (format === "pdf") {
    let pdf: jsPDF | null = null;
    for (const unit of units) {
      const canvas = await renderToCanvas(unit);
      const orientation = unit.widthMm >= unit.heightMm ? "landscape" : "portrait";
      const size: [number, number] = [unit.widthMm, unit.heightMm];
      if (!pdf) {
        pdf = new jsPDF({ orientation, unit: "mm", format: size, compress: true });
      } else {
        pdf.addPage(size, orientation);
      }
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, unit.widthMm, unit.heightMm);
    }
    if (pdf) saveBlob(pdf.output("blob"), `${baseName}.pdf`);
    return;
  }

  const type = format === "png" ? "image/png" : "image/jpeg";
  const ext = format === "png" ? "png" : "jpg";
  if (units.length === 1) {
    saveBlob(await canvasToBlob(await renderToCanvas(units[0]), type), `${baseName}.${ext}`);
    return;
  }
  const zip = new JSZip();
  const used = new Set<string>();
  for (const unit of units) {
    let name = unit.name;
    for (let n = 2; used.has(name); n++) name = `${unit.name}-${n}`;
    used.add(name);
    zip.file(`${name}.${ext}`, await canvasToBlob(await renderToCanvas(unit), type));
  }
  saveBlob(await zip.generateAsync({ type: "blob" }), `${baseName}.zip`);
}
