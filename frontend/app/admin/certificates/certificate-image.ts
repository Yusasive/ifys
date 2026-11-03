import JSZip from "jszip";

// Where the name goes on public/certificate/template.png (1801 x 1286 px).
// Mirrors backend/src/email/certificate-layout.ts, which draws the same name
// on the emailed PDF — keep the two in step.
const NAME_LEFT_PX = 366;
const NAME_BASELINE_PX = 640;
const NAME_MAX_WIDTH_PX = 1510 - NAME_LEFT_PX;
const NAME_MAX_FONT_PX = 84;
const NAME_MIN_FONT_PX = 26;
const NAME_COLOR = "#1E5A47";
const FONT_FAMILY = "CertificateName";
const JPEG_QUALITY = 0.95;

let assets: Promise<HTMLImageElement> | null = null;

// The template and the name font, loaded once per page.
function loadAssets(): Promise<HTMLImageElement> {
  assets ??= (async () => {
    const font = new FontFace(FONT_FAMILY, "url(/certificate/name-font.ttf)", { weight: "600" });
    const image = new Image();
    image.src = "/certificate/template.png";
    const [loadedFont] = await Promise.all([font.load(), image.decode()]);
    document.fonts.add(loadedFont);
    return image;
  })().catch((err) => {
    assets = null;
    throw err;
  });
  return assets;
}

async function renderCertificate(name: string): Promise<Blob> {
  const image = await loadAssets();
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
    widthAtMax > NAME_MAX_WIDTH_PX
      ? Math.max(NAME_MIN_FONT_PX, Math.floor((NAME_MAX_FONT_PX * NAME_MAX_WIDTH_PX) / widthAtMax))
      : NAME_MAX_FONT_PX;
  ctx.font = `600 ${fontPx}px ${FONT_FAMILY}`;
  ctx.fillStyle = NAME_COLOR;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(displayName, NAME_LEFT_PX, NAME_BASELINE_PX);

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
export async function downloadCertificates(names: string[]) {
  if (names.length === 0) return;
  if (names.length === 1) {
    saveBlob(await renderCertificate(names[0]), `certificate-${fileSafe(names[0])}.jpg`);
    return;
  }
  const zip = new JSZip();
  const used = new Set<string>();
  for (const name of names) {
    let base = `certificate-${fileSafe(name)}`;
    for (let n = 2; used.has(base); n++) base = `certificate-${fileSafe(name)}-${n}`;
    used.add(base);
    zip.file(`${base}.jpg`, await renderCertificate(name));
  }
  saveBlob(await zip.generateAsync({ type: "blob" }), "certificates.zip");
}
