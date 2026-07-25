"use server";


import { hasSectionEdit } from "@/app/dashboard/admin/permissions/actions";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { askAI, embedText, generateText, isAiConfigured } from "@/lib/ai";
import { requireRole, requireUser } from "@/lib/session";

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export async function createResourceDocument(formData: FormData) {
  if (!(await hasSectionEdit("knowledge-base"))) return { success: false as const, error: "Your role has view-only access to this section. Ask an administrator for edit access." };

  try {
    await requireRole("FACULTY", "MANAGER", "ADMIN", "SUPER_ADMIN");
  } catch {
    return { error: "Only staff can add knowledge base documents." };
  }

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;

  if (!title || !content) {
    return { error: "Title and content are required" };
  }

  try {
    const doc = await prisma.resourceDocument.create({
      data: {
        title,
        content,
      },
    });

    // Embed for RAG retrieval (skipped in dev mode without an API key)
    if (isAiConfigured()) {
      try {
        const embedding = await embedText(`${title}\n\n${content}`.slice(0, 8000));
        await prisma.$executeRaw`
          UPDATE resource_documents
          SET embedding = ${toVectorLiteral(embedding)}::vector
          WHERE id = ${doc.id}
        `;
      } catch (embedError) {
        // Document is still saved; it just won't be retrievable via vector search
        console.error("Failed to embed document:", embedError);
      }
    }

    revalidatePath("/dashboard/knowledge-base");
    return { success: true };
  } catch (error) {
    console.error("Error creating document:", error);
    return { error: "Failed to create document" };
  }
}

export async function getResourceDocuments() {
  try {
    await requireUser();
    const documents = await prisma.resourceDocument.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });
    return { documents };
  } catch (error) {
    console.error("Error fetching documents:", error);
    return { error: "Failed to fetch documents" };
  }
}

export async function chatWithAI(formData: FormData) {
  try {
    await requireUser();
  } catch {
    return { error: "Please log in to use the AI assistant." };
  }

  const question = formData.get("question") as string;

  if (!question) {
    return { error: "Question is required" };
  }

  try {
    // Without an API key, fall back to the simulated assistant
    if (!isAiConfigured()) {
      return { response: await askAI(question) };
    }

    // RAG: retrieve the most relevant documents via pgvector cosine distance
    const queryEmbedding = await embedText(question);
    const contextDocs = await prisma.$queryRaw<
      { id: string; title: string; content: string }[]
    >`
      SELECT id, title, content
      FROM resource_documents
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${toVectorLiteral(queryEmbedding)}::vector
      LIMIT 4
    `;

    if (contextDocs.length === 0) {
      const answer = await generateText(
        `You are a helpful university assistant. The knowledge base is currently empty, so answer from general knowledge and say that no university-specific documents were found.\n\nQuestion: ${question}`
      );
      return { response: answer };
    }

    const context = contextDocs
      .map((d, i) => `[Document ${i + 1}: ${d.title}]\n${d.content.slice(0, 4000)}`)
      .join("\n\n---\n\n");

    const answer = await generateText(
      `You are the university's AI assistant. Answer the student's question using ONLY the university documents below. Cite the document title you used. If the documents don't contain the answer, say so honestly.\n\n${context}\n\n---\n\nQuestion: ${question}`
    );

    return { response: answer };
  } catch (error) {
    console.error("Error in chatWithAI:", error);
    const overloaded = error instanceof Error && /503|429|UNAVAILABLE|overloaded|high demand/i.test(error.message);
    return {
      error: overloaded
        ? "Google's free AI tier is at capacity right now — this usually clears within a minute or two. Please try again shortly."
        : "The AI assistant is temporarily unavailable. Please try again.",
    };
  }
}
