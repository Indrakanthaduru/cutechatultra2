/**
 * Utility functions for PDF processing
 */

/**
 * Split text into chunks of approximately 700-900 characters
 * Tries to split at word boundaries to avoid cutting words in half
 */
export function chunkText(
  text: string,
  minChunkSize: number = 700,
  maxChunkSize: number = 900
): string[] {
  const chunks: string[] = [];
  let currentChunk = "";

  const words = text.split(/\s+/);

  for (const word of words) {
    // If adding this word would exceed max size, save current chunk and start new one
    if (currentChunk.length + word.length + 1 > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = word;
    } else {
      currentChunk += (currentChunk.length > 0 ? " " : "") + word;
    }
  }

  // Add any remaining text
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

/**
 * Calculate cosine similarity between two vectors
 * Returns a value between 0 and 1, where 1 means identical
 */
export function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error("Vectors must have the same length");
  }

  if (vectorA.length === 0) {
    return 0;
  }

  // Calculate dot product
  let dotProduct = 0;
  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
  }

  // Calculate magnitudes
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < vectorA.length; i++) {
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  // Avoid division by zero
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Find the top N most similar chunks based on cosine similarity
 */
export function findSimilarChunks(
  queryEmbedding: number[],
  chunkEmbeddings: Array<{ id: string; text: string; embedding: number[] }>,
  topK: number = 3
): Array<{ id: string; text: string; similarity: number }> {
  // Calculate similarity for all chunks
  const similarities = chunkEmbeddings.map((chunk) => ({
    id: chunk.id,
    text: chunk.text,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // Sort by similarity descending and take top K
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
