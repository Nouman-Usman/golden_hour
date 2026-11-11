"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Posts to the upload route (not a server action: those cap bodies at 1 MB).
export function ImageUploader({ productId, full }: { productId: string; full: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch(`/admin/products/${productId}/images`, { method: "POST", body });
      const r = (await res.json().catch(() => null)) as { ok: boolean; error?: string; message?: string } | null;
      setMsg(r?.ok ? { ok: true, text: r.message ?? "Image added." } : { ok: false, text: r?.error ?? "Upload failed. Try again." });
      if (r?.ok) router.refresh();
    } catch {
      setMsg({ ok: false, text: "Upload failed. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  if (full) return <p className="text-sm text-ash">This product has the maximum of 6 images.</p>;
  return (
    <div className="grid gap-2">
      <label className={`btn btn-sm btn-outline w-fit ${busy ? "opacity-60" : "cursor-pointer"}`}>
        {busy ? "Uploading…" : "Add image"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }}
        />
      </label>
      <p className="text-xs text-ash">JPEG, PNG or WebP, up to 5 MB.</p>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
