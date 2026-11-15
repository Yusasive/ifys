import JSZip from "jszip";

export type CertificateKind = "participation" | "organising-team";

const TEMPLATES: Record<CertificateKind, { src: string; left: number; baseline: number; maxWidth: number }> = {
  participation: {
    src: "/certificate/template.png",
    left: 366,
    baseline: 640,
    maxWidth: 1510 - 366,
  },
  // Sits on the black rule running from x=100 to x=1388 at y=595.
  "organising-team": {
    src: "/certificate/organising-team-template.png",
    left: 106,
    baseline: 575,
    maxWidth: 1388 - 106,
  },
};
const NAME_MAX_FONT_PX = 84;
const NAME_MIN_FONT_PX = 26;
const NAME_COLOR = "#1E5A47";
const FONT_FAMILY = "CertificateName";
const JPEG_QUALITY = 0.95;

const assets = new Map<CertificateKind, Promise<HTMLImageElement>>();

// A template and the name font, loaded once per page.
function loadAssets(kind: CertificateKind): Promise<HTMLImageElement> {
  let pending = assets.get(kind);
  if (!pending) {
    pending = (async () => {
      const font = new FontFace(FONT_FAMILY, "url(/certificate/name-font.ttf)", { weight: "600" });
      const image = new Image();
      image.src = TEMPLATES[kind].src;
      const [loadedFont] = await Promise.all([font.load(), image.decode()]);
      document.fonts.add(loadedFont);
      return image;
    })().catch((err) => {
      assets.delete(kind);
      throw err;
    });
    assets.set(kind, pending);
  }
  return pending;
}

async function renderCertificate(name: string, kind: CertificateKind): Promise<Blob> {
  const { left, baseline, maxWidth } = TEMPLATES[kind];
  const image = await loadAssets(kind);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the certificate image.");

  ctx.drawImage(image, 0, 0);
  const displayName = name.trim().replace(/\s+/g, " ");
  ctx.font = `600 ${NAME_MAX_FONT_PX}px ${FONT_FAMILY}`;
  // Longest names shrink to fit the line instead of running off the page.
  const widthAtMax = ctx.measureText(displayName).width;
  const fontPx =
    widthAtMax > maxWidth
      ? Math.max(NAME_MIN_FONT_PX, Math.floor((NAME_MAX_FONT_PX * maxWidth) / widthAtMax))
      : NAME_MAX_FONT_PX;
  ctx.font = `600 ${fontPx}px ${FONT_FAMILY}`;
  ctx.fillStyle = NAME_COLOR;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(displayName, left, baseline);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create the certificate image."))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

function fileSafe(name: string): string {
  return name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "certificate";
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

// One person downloads as a JPEG; several download together as a zip.
export async function downloadCertificates(names: string[], kind: CertificateKind = "participation") {
  if (names.length === 0) return;
  if (names.length === 1) {
    saveBlob(await renderCertificate(names[0], kind), `certificate-${fileSafe(names[0])}.jpg`);
    return;
  }
  const zip = new JSZip();
  const used = new Set<string>();
  for (const name of names) {
    let base = `certificate-${fileSafe(name)}`;
    for (let n = 2; used.has(base); n++) base = `certificate-${fileSafe(name)}-${n}`;
    used.add(base);
    zip.file(`${base}.jpg`, await renderCertificate(name, kind));
  }
  saveBlob(await zip.generateAsync({ type: "blob" }), kind === "organising-team" ? "organising-team-certificates.zip" : "certificates.zip");
}
