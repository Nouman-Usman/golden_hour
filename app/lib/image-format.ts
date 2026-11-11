export type ImageFormat = "jpeg" | "png" | "webp";

export const imageMime: Record<ImageFormat, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
export const imageExt: Record<ImageFormat, string> = { jpeg: "jpg", png: "png", webp: "webp" };

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

// Trust the file's first bytes, never the browser's MIME type or file name. SVG and everything else → null.
export function detectImageFormat(b: Uint8Array): ImageFormat | null {
  if (starts(b, [0xff, 0xd8, 0xff])) return "jpeg";
  if (starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (starts(b, ascii("RIFF")) && starts(b, ascii("WEBP"), 8)) return "webp";
  return null;
}
