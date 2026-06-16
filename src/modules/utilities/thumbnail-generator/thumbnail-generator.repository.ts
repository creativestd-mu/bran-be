import { prisma } from "../../../lib/prisma";

export async function createThumbnailGeneration(data: {
  userId: string;
  inputTitle: string;
  inputDescription: string;
  inputContext?: string | null;
  referencePaths: string[];
  outputTitle: string;
  outputTextDescription: string;
  outputContext: string;
  assets: unknown[];
  designBrief: string;
  styleFromReferences: string;
  generatedImagePath?: string | null;
  generatedMimeType?: string | null;
  generatedFileSizeBytes?: number | null;
}) {
  return prisma.thumbnailGeneration.create({
    data: {
      userId: data.userId,
      inputTitle: data.inputTitle,
      inputDescription: data.inputDescription,
      inputContext: data.inputContext ?? null,
      referencePaths: JSON.stringify(data.referencePaths),
      outputTitle: data.outputTitle,
      outputTextDescription: data.outputTextDescription,
      outputContext: data.outputContext,
      assets: JSON.stringify(data.assets),
      designBrief: data.designBrief,
      styleFromReferences: data.styleFromReferences,
      generatedImagePath: data.generatedImagePath ?? null,
      generatedMimeType: data.generatedMimeType ?? null,
      generatedFileSizeBytes: data.generatedFileSizeBytes ?? null
    }
  });
}

export async function findThumbnailGenerationById(id: string) {
  return prisma.thumbnailGeneration.findUnique({ where: { id } });
}

export async function listThumbnailGenerationsByUser(params: {
  userId: string;
  page: number;
  pageSize: number;
}) {
  const skip = (params.page - 1) * params.pageSize;

  const [items, total] = await Promise.all([
    prisma.thumbnailGeneration.findMany({
      where: { userId: params.userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: params.pageSize
    }),
    prisma.thumbnailGeneration.count({ where: { userId: params.userId } })
  ]);

  return { items, total };
}
