import { embed } from "ai";
import * as pdfjsLib from "pdfjs-dist";
import { nanoid } from "nanoid";
import { auth } from "@/app/(auth)/auth";
import { pdfStorage } from "@/lib/pdf/storage";
import { chunkText } from "@/lib/pdf/utils";
import { ChatSDKError } from "@/lib/errors";

// Configure PDF.js worker
if (typeof window === "undefined") {
  const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.mjs");
  pdfjsLib.GlobalWorkerOptions.workerPort = new pdfjsWorker.WorkerMessagePort(
    pdfjsLib.GlobalWorkerOptions.workerPort
  );
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

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

    // Read PDF file
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    // Extract text from all pages
    let fullText = "";
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      fullText += pageText + "\n";
    }

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
    const document = pdfStorage.storeDocument(
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
