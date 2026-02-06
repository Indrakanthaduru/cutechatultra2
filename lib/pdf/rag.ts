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
    // Get the document
    const document = pdfStorage.getDocument(documentId);
    if (!document) {
      return null;
    }

    // Embed the query
    const { embedding: queryEmbedding } = await embed({
      model: "text-embedding-3-small",
      value: query,
    });

    // Find similar chunks
    const similarChunks = findSimilarChunks(
      queryEmbedding,
      document.chunks,
      Math.min(topK, 10)
    );

    return {
      documentId,
      filename: document.filename,
      relevantChunks: similarChunks.map((chunk) => ({
        text: chunk.text,
        similarity: chunk.similarity,
      })),
    };
  } catch (error) {
    console.error("Error getting RAG context:", error);
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
