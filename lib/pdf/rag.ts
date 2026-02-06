import { embed } from "ai";
import { pdfStorage } from "./storage";
import { findSimilarChunks } from "./utils";

export interface RAGContext {
  documentId: string;
  filename: string;
  relevantChunks: Array<{
    text: string;
    similarity: number;
  }>;
}

/**
 * Get RAG context for a query from a specific PDF document
 */
export async function getRAGContext(
  query: string,
  documentId: string,
  topK: number = 3
): Promise<RAGContext | null> {
  try {
    // Get the document from storage
    const document = pdfStorage.getDocument(documentId);
    
    console.log("[v0] RAG: Looking for document:", documentId);
    console.log(
      "[v0] RAG: Document found:",
      document ? `${document.filename} (${document.chunks.length} chunks)` : "NOT FOUND"
    );

    if (!document) {
      console.error(
        "[v0] RAG: Document not found in storage. Available docs:",
        pdfStorage.getAllDocuments().map((d) => d.id)
      );
      return null;
    }

    if (document.chunks.length === 0) {
      console.error("[v0] RAG: Document has no chunks");
      return null;
    }

    console.log("[v0] RAG: Embedding query:", query.substring(0, 50) + "...");

    // Embed the query
    const { embedding: queryEmbedding } = await embed({
      model: "text-embedding-3-small",
      value: query,
    });

    console.log("[v0] RAG: Query embedded, embedding length:", queryEmbedding.length);

    // Find similar chunks
    const similarChunks = findSimilarChunks(
      queryEmbedding,
      document.chunks,
      Math.min(topK, 10)
    );

    console.log("[v0] RAG: Found", similarChunks.length, "similar chunks");

    return {
      documentId,
      filename: document.filename,
      relevantChunks: similarChunks.map((chunk) => ({
        text: chunk.text,
        similarity: chunk.similarity,
      })),
    };
  } catch (error) {
    console.error("[v0] RAG: Error getting RAG context:", error);
    return null;
  }
}

/**
 * Format RAG context for injection into system prompt
 */
export function formatRAGContext(ragContext: RAGContext | null): string {
  if (!ragContext || ragContext.relevantChunks.length === 0) {
    return "";
  }

  const contextText = ragContext.relevantChunks
    .map((chunk) => chunk.text)
    .join("\n\n");

  return `Use the following PDF context (from "${ragContext.filename}") to answer the user's question accurately:

<pdf_context>
${contextText}
</pdf_context>

`;
}
