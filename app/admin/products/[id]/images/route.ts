import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "../../../../../db/index.ts";
import { DomainError } from "../../../../lib/errors.ts";
import { MAX_IMAGE_BYTES } from "../../../../lib/image-store.ts";
import { addProductImage, PRODUCTS_TAG } from "../../../../lib/products.ts";
import { supabaseImageStore } from "../../../../lib/supabase-image-store.ts";
import { readImageUpload } from "../../../../lib/upload.ts";
import { toActionError } from "../../../action-error.ts";
import { requireStaffAction } from "../../../guard.ts";

// Image uploads use this route, not a server action (Server Actions cap request bodies at 1 MB).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireStaffAction("products.edit");
    const read = await readImageUpload(req, MAX_IMAGE_BYTES);
    if ("error" in read) return NextResponse.json({ ok: false, error: read.error }, { status: read.status });
    if (!db) throw new DomainError("misconfigured", "Database isn't configured.");
    const { id } = await ctx.params;
    const url = await addProductImage(db, supabaseImageStore, actor, { productId: id, bytes: read.bytes });
    revalidateTag(PRODUCTS_TAG, "max"); // updateTag is server-action only
    return NextResponse.json({ ok: true, message: "Image added.", url });
  } catch (e) {
    const status =
      e instanceof DomainError
        ? ({ unauthenticated: 401, forbidden: 403, not_found: 404, invalid_input: 422 } as Record<string, number>)[e.code] ?? 500
        : 500;
    return NextResponse.json(toActionError(e), { status });
  }
}
