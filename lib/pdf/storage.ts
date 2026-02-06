// In-memory PDF storage with embeddings
// This stores PDF content and embeddings for RAG

export interface PDFChunk {
  id: string;
  text: string;
  embedding: number[];
}

export interface PDFDocument {
  id: string;
  filename: string;
  chunks: PDFChunk[];
  createdAt: Date;
}

class PDFStorage {
  private documents: Map<string, PDFDocument> = new Map();

  /**
   * Store a PDF document with its chunks and embeddings
   */
  storeDocument(
    documentId: string,
    filename: string,
    chunks: PDFChunk[]
  ): PDFDocument {
    const document: PDFDocument = {
      id: documentId,
      filename,
      chunks,
      createdAt: new Date(),
    };

    this.documents.set(documentId, document);
    return document;
  }

  /**
   * Retrieve a document by ID
   */
  getDocument(documentId: string): PDFDocument | undefined {
    return this.documents.get(documentId);
  }

  /**
   * Delete a document
   */
  deleteDocument(documentId: string): boolean {
    return this.documents.delete(documentId);
  }

  /**
   * Get all documents
   */
  getAllDocuments(): PDFDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Clear all documents
   */
  clearAll(): void {
    this.documents.clear();
  }
}

// Global instance
export const pdfStorage = new PDFStorage();
