import { env } from "../../config/env";
import { EMBEDDING_DIMENSION } from "./ai.gemini-embeddings";

export { EMBEDDING_DIMENSION as VECTOR_DIMENSION } from "./ai.gemini-embeddings";

export type VectorMatch = {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
};

interface QdrantClientLike {
  getCollections(): Promise<{ collections: Array<{ name: string }> }>;
  getCollection(name: string): Promise<{
    config?: { params?: { vectors?: { size?: number } | Record<string, unknown> } };
  }>;
  deleteCollection(name: string): Promise<unknown>;
  createCollection(
    name: string,
    schema: { vectors: { size: number; distance: string } }
  ): Promise<unknown>;
  upsert(
    collection: string,
    request: {
      wait: boolean;
      points: Array<{
        id: string;
        vector: number[];
        payload: Record<string, string | number | boolean>;
      }>;
    }
  ): Promise<unknown>;
  search(
    collection: string,
    request: {
      vector: number[];
      limit: number;
      with_payload: boolean;
      filter?: { must: Array<Record<string, unknown>> };
    }
  ): Promise<Array<{ id: unknown; score?: number; payload?: Record<string, unknown> | null }>>;
  delete(collection: string, request: { wait: boolean; points: string[] }): Promise<unknown>;
}

let qdrantClient: QdrantClientLike | null = null;
const ensuredCollections = new Set<string>();

export function isQdrantConfigured(): boolean {
  return Boolean(env.qdrantUrl);
}

async function getQdrant(): Promise<QdrantClientLike> {
  if (!qdrantClient) {
    if (!env.qdrantUrl) {
      throw new Error("QDRANT_URL is not configured");
    }

    const { QdrantClient } = await import("@qdrant/js-client-rest");
    qdrantClient = new QdrantClient({
      url: env.qdrantUrl,
      apiKey: env.qdrantApiKey || undefined
    }) as QdrantClientLike;
  }

  return qdrantClient;
}

function toQdrantFilter(filter?: Record<string, unknown>) {
  if (!filter || Object.keys(filter).length === 0) {
    return undefined;
  }

  const must: Array<Record<string, unknown>> = [];

  for (const [key, condition] of Object.entries(filter)) {
    if (!condition || typeof condition !== "object") {
      continue;
    }

    if ("$eq" in condition) {
      must.push({ key, match: { value: condition.$eq } });
      continue;
    }

    if ("$gt" in condition) {
      must.push({ key, range: { gt: condition.$gt } });
    }
  }

  return must.length > 0 ? { must } : undefined;
}

async function ensureCollection(collection: string): Promise<void> {
  if (ensuredCollections.has(collection)) {
    return;
  }

  const client = await getQdrant();
  const existing = await client.getCollections();
  const found = existing.collections.some((entry) => entry.name === collection);

  if (found) {
    const info = await client.getCollection(collection);
    const vectorParams = info.config?.params?.vectors;
    const existingSize =
      vectorParams && typeof vectorParams === "object" && "size" in vectorParams
        ? Number(vectorParams.size)
        : undefined;

    if (existingSize && existingSize !== EMBEDDING_DIMENSION) {
      await client.deleteCollection(collection);
    } else {
      ensuredCollections.add(collection);
      return;
    }
  }

  await client.createCollection(collection, {
    vectors: {
      size: EMBEDDING_DIMENSION,
      distance: "Cosine"
    }
  });

  ensuredCollections.add(collection);
}

export async function upsertVectors(
  collection: string,
  vectors: {
    id: string;
    values: number[];
    metadata: Record<string, string | number | boolean>;
  }[]
): Promise<void> {
  if (vectors.length === 0) {
    return;
  }

  await ensureCollection(collection);

  const client = await getQdrant();
  await client.upsert(collection, {
    wait: true,
    points: vectors.map((vector) => ({
      id: vector.id,
      vector: vector.values,
      payload: vector.metadata
    }))
  });
}

export async function queryVectors(
  collection: string,
  vector: number[],
  topK: number = 10,
  filter?: Record<string, unknown>
): Promise<{ matches: VectorMatch[] }> {
  await ensureCollection(collection);

  const client = await getQdrant();
  const result = await client.search(collection, {
    vector,
    limit: topK,
    with_payload: true,
    filter: toQdrantFilter(filter)
  });

  return {
    matches: result.map((point) => ({
      id: String(point.id),
      score: point.score ?? 0,
      metadata: (point.payload ?? {}) as Record<string, unknown>
    }))
  };
}

export async function deleteVectors(collection: string, ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const client = await getQdrant();
  await client.delete(collection, {
    wait: true,
    points: ids
  });
}
