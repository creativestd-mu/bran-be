import { Pinecone } from "@pinecone-database/pinecone";

import { env } from "../../config/env";

let pineconeClient: Pinecone | null = null;

export function getPinecone(): Pinecone {
  if (!pineconeClient) {
    if (!env.pineconeApiKey) {
      throw new Error("PINECONE_API_KEY is not configured");
    }
    pineconeClient = new Pinecone({ apiKey: env.pineconeApiKey });
  }
  return pineconeClient;
}

export function getIndex() {
  return getPinecone().index(env.pineconeIndex);
}

export async function upsertVectors(
  namespace: string,
  vectors: { id: string; values: number[]; metadata: Record<string, string | number | boolean> }[]
) {
  const index = getIndex();
  const ns = index.namespace(namespace);
  await ns.upsert({
    records: vectors.map((v) => ({ id: v.id, values: v.values, metadata: v.metadata }))
  });
}

export async function queryVectors(
  namespace: string,
  vector: number[],
  topK: number = 10,
  filter?: Record<string, unknown>
) {
  const index = getIndex();
  const ns = index.namespace(namespace);
  return ns.query({
    vector,
    topK,
    includeMetadata: true,
    filter
  });
}

export async function deleteVectors(namespace: string, ids: string[]) {
  const index = getIndex();
  const ns = index.namespace(namespace);
  await ns.deleteMany(ids);
}
