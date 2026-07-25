/**
 * One-time setup for the private Supabase Storage bucket used by ticket
 * attachments. Idempotent. Run with: npx tsx scripts/setup-storage.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "ticket-attachments";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  const wanted: { name: string; isPublic: boolean }[] = [
    { name: BUCKET, isPublic: false }, // ticket attachments — signed URLs only
    { name: "announcements", isPublic: true }, // announcement banners — public display
  ];

  for (const w of wanted) {
    if (buckets?.some((b) => b.name === w.name)) {
      console.log(`Bucket "${w.name}" already exists.`);
      continue;
    }
    const { error } = await supabase.storage.createBucket(w.name, {
      public: w.isPublic,
      fileSizeLimit: "10MB",
    });
    if (error) throw error;
    console.log(`Created ${w.isPublic ? "public" : "private"} bucket "${w.name}" (10MB limit).`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
