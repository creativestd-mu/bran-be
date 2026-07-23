import { prisma } from "../../lib/prisma";
import type { WorkIngestSourceType } from "./work.constants";

export async function findWorkUnitSource(sourceType: WorkIngestSourceType, sourceId: string) {
  return prisma.workUnitSource.findUnique({
    where: {
      sourceType_sourceId: { sourceType, sourceId }
    }
  });
}

export async function recordWorkUnitSource(input: {
  sourceType: WorkIngestSourceType;
  sourceId: string;
  status: "PROCESSED" | "SKIPPED" | "ERROR";
  workUnitCount: number;
  errorMessage?: string | null;
}) {
  return prisma.workUnitSource.upsert({
    where: {
      sourceType_sourceId: {
        sourceType: input.sourceType,
        sourceId: input.sourceId
      }
    },
    create: {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      status: input.status,
      workUnitCount: input.workUnitCount,
      errorMessage: input.errorMessage ?? null
    },
    update: {
      status: input.status,
      workUnitCount: input.workUnitCount,
      errorMessage: input.errorMessage ?? null,
      processedAt: new Date()
    }
  });
}

export async function loadProcessedSourceKeys(
  sourceType: WorkIngestSourceType
): Promise<Set<string>> {
  const rows = await prisma.workUnitSource.findMany({
    where: { sourceType },
    select: { sourceId: true }
  });
  return new Set(rows.map((row) => row.sourceId));
}
