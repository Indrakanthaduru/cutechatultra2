import { embed } from "ai";
import { auth } from "@/app/(auth)/auth";
import { pdfStorage } from "@/lib/pdf/storage";
import { findSimilarChunks } from "@/lib/pdf/utils";
import { ChatSDKError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { query, documentId, topK = 3 } = await request.json();

    if (!query || typeof query !== "string") {
      return Response.json(
        { error: "Query is required and must be a string" },
        { status: 400 }
      );
    }

    if (!documentId || typeof documentId !== "string") {
      return Response.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    // Get the document
    const document = pdfStorage.getDocument(documentId);
    if (!document) {
      return Response.json(
        { error: "Document not found" },
        { status: 404 }
      );
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
      Math.min(topK, 10) // Limit to max 10 chunks
    );

    return Response.json({
      success: true,
      query,
      chunks: similarChunks,
      chunkCount: similarChunks.length,
    });
  } catch (error) {
    console.error("PDF search error:", error);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return Response.json(
      { error: "Failed to search PDF" },
      { status: 500 }
    );
  }
}
