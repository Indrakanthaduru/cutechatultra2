import { embed } from "ai";
import pdfParse from "pdf-parse";
import { nanoid } from "nanoid";
import { auth } from "@/app/(auth)/auth";
import { pdfStorage } from "@/lib/pdf/storage";
import { chunkText } from "@/lib/pdf/utils";
import { ChatSDKError } from "@/lib/errors";

/**
 * Helper function to check if an error is a PDF parsing error
 * Handles FormatError, UnknownErrorException, and other pdf-parse specific errors
 */
function isPDFParsingError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    
    // Check for common PDF corruption/format errors
    return (
      name.includes("formaterror") ||
      name.includes("unknownerror") ||
      message.includes("xref") ||
      message.includes("bad stream") ||
      message.includes("invalid object") ||
      message.includes("corrupt") ||
      message.includes("malformed")
    );
  }
  return false;
}

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

    // Read PDF file as buffer (using Buffer.from, not deprecated Buffer constructor)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Wrap PDF parsing in dedicated try/catch to handle corrupted files
    let pdfData;
    try {
      pdfData = await pdfParse(buffer);
    } catch (parseError) {
      console.error("PDF parsing error:", parseError);

      // If it's a known PDF corruption/format error, return user-friendly message
      if (isPDFParsingError(parseError)) {
        return Response.json(
          {
            error: "This PDF cannot be read. Please upload a text-based PDF.",
            details: "The PDF file is corrupted or uses an unsupported format.",
          },
          { status: 400 }
        );
      }

      // Re-throw unexpected errors to be caught by outer catch block
      throw parseError;
    }

    // Extract text from parsed PDF
    const fullText = pdfData.text || "";

    // Validate extracted text - handles scanned PDFs and image-only PDFs
    if (!fullText.trim()) {
      return Response.json(
        {
          error: "This PDF cannot be read. Please upload a text-based PDF.",
          details:
            "No text content found. The PDF may be a scanned image without OCR.",
        },
        { status: 400 }
      );
    }

    // Split text into chunks for embedding
    const chunks = chunkText(fullText);

    if (chunks.length === 0) {
      return Response.json(
        {
          error: "This PDF cannot be read. Please upload a text-based PDF.",
          details: "Failed to extract meaningful content from the PDF.",
        },
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

    // Store document in memory with its chunks and embeddings
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
    // Log the actual error for debugging
    console.error("PDF upload error:", error);

    // Handle SDK authentication errors
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // For any other unexpected errors, return generic server error
    return Response.json(
      { error: "Failed to process PDF. Please try again later." },
      { status: 500 }
    );
  }
}
