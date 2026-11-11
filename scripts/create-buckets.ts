// node --env-file=.env scripts/create-buckets.ts
// Creates the public product-images bucket if it's missing. Changes the live Supabase project.
import { IMAGE_BUCKET, serviceClient } from "../app/lib/supabase-storage.ts";

const { client } = serviceClient();
const { data } = await client.storage.getBucket(IMAGE_BUCKET);
if (data) {
  console.log("exists");
} else {
  const { error } = await client.storage.createBucket(IMAGE_BUCKET, {
    public: true,
    fileSizeLimit: 5_242_880,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (error) throw new Error(`createBucket: ${error.message}`);
  console.log("created");
}
