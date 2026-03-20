import OpenAI from "openai";

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY non configurata");
  }
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

/**
 * Generate an embedding vector for a text string using OpenAI text-embedding-3-small.
 * Returns a 1536-dimensional vector.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const cleaned = text.replace(/\n/g, " ").trim();
  if (!cleaned) {
    throw new Error("Testo vuoto per embedding");
  }

  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: cleaned,
    dimensions: 1536,
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a single batch call.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const cleaned = texts.map((t) => t.replace(/\n/g, " ").trim());

  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: cleaned,
    dimensions: 1536,
  });

  return response.data.map((d) => d.embedding);
}
