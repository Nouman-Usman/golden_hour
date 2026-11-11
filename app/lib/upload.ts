const TOO_BIG = "Images must be 5 MB or smaller.";
const MULTIPART_SLACK = 64 * 1024;

// Reads the `file` field of a multipart upload, refusing oversize bodies before parsing when possible.
export async function readImageUpload(
  req: Request,
  maxBytes: number,
): Promise<{ bytes: Uint8Array } | { error: string; status: number }> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes + MULTIPART_SLACK) return { error: TOO_BIG, status: 413 };

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { error: "Choose an image.", status: 400 };
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) return { error: "Choose an image.", status: 400 };
  if (file.size > maxBytes) return { error: TOO_BIG, status: 413 };
  return { bytes: new Uint8Array(await file.arrayBuffer()) };
}
