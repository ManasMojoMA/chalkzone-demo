/**
 * Backfills pgvector embeddings for knowledge-base documents that don't
 * have one yet (e.g. docs created before GEMINI_API_KEY was configured).
 * Run with: npm run db:embed
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { embedText, isAiConfigured } from "../src/lib/ai";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  if (!isAiConfigured()) {
    console.error("GEMINI_API_KEY is not set — cannot generate embeddings.");
    process.exit(1);
  }

  const docs = await prisma.$queryRaw<{ id: string; title: string; content: string }[]>`
    SELECT id, title, content FROM resource_documents WHERE embedding IS NULL
  `;

  if (docs.length === 0) {
    console.log("All documents already have embeddings.");
    return;
  }

  console.log(`Embedding ${docs.length} document(s)...`);
  for (const doc of docs) {
    try {
      const embedding = await embedText(`${doc.title}\n\n${doc.content}`.slice(0, 8000));
      await prisma.$executeRaw`
        UPDATE resource_documents
        SET embedding = ${`[${embedding.join(",")}]`}::vector
        WHERE id = ${doc.id}
      `;
      console.log(`  ✓ ${doc.title}`);
    } catch (error) {
      console.error(`  ✗ ${doc.title}:`, error instanceof Error ? error.message : error);
    }
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
