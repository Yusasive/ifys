// Where the recipient's name goes on assets/certificate-template.png (1801 x
// 1286 px). Mirrored by frontend/app/admin/certificates/certificate-image.ts,
// which draws the same name for the JPEG downloads — keep the two in step.
export const CERTIFICATE_WIDTH_PX = 1801;
export const CERTIFICATE_HEIGHT_PX = 1286;

// Left-aligned with "THIS CERTIFICATE IS AWARDED TO", sitting on the black
// rule that runs from x=360 to x=1510 at y=660.
export const NAME_LEFT_PX = 366;
export const NAME_BASELINE_PX = 640;
export const NAME_MAX_WIDTH_PX = 1510 - NAME_LEFT_PX;
export const NAME_MAX_FONT_PX = 84;
export const NAME_MIN_FONT_PX = 26;
export const NAME_COLOR = '#1E5A47';
