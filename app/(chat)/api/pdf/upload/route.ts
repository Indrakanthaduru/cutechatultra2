import { embed } from "ai";
import pdfParse from "pdf-parse";
import { nanoid } from "nanoid";
import { auth } from "@/app/(auth)/auth";
import { pdfStorage } from "@/lib/pdf/storage";
import { chunkText } from "@/lib/pdf/utils";
import { ChatSDKError } from "@/lib/errors";

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type || !file.type.includes("pdf")) {
      return Response.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // Read PDF file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text using pdf-parse (server-only, no workers)
    const pdfData = await pdfParse(buffer);
    const fullText = pdfData.text;

    // Validate extracted text
    if (!fullText.trim()) {
      return Response.json(
        { error: "No text could be extracted from the PDF" },
        { status: 400 }
      );
    }

    // Split text into chunks
    const chunks = chunkText(fullText);

    if (chunks.length === 0) {
      return Response.json(
        { error: "Failed to process PDF text" },
        { status: 400 }
      );
    }

    // Generate embeddings for each chunk
    const embeddedChunks = await Promise.all(
      chunks.map(async (text) => {
        const { embedding } = await embed({
          model: "text-embedding-3-small",
          value: text,
        });

        return {
          id: nanoid(),
          text,
          embedding,
        };
      })
    );

    // Store in memory
    const documentId = nanoid();
    pdfStorage.storeDocument(
      documentId,
      file.name,
      embeddedChunks
    );

    return Response.json({
      success: true,
      documentId,
      filename: file.name,
      chunkCount: embeddedChunks.length,
    });
  } catch (error) {
    console.error("PDF upload error:", error);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return Response.json(
      { error: "Failed to process PDF" },
      { status: 500 }
    );
  }
}
