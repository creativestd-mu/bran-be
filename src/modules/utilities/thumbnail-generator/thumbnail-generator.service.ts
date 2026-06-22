import { randomUUID } from "node:crypto";

import { HttpError } from "../../../utils/httpError";
import {
  analyzeThumbnailReferences,
  generateThumbnailImage,
  type ThumbnailReferenceImage
} from "./thumbnail-generator.ai";
import {
  createThumbnailGeneration,
  findThumbnailGenerationById,
  listThumbnailGenerationsByUser
} from "./thumbnail-generator.repository";
import {
  openThumbnailReadStream,
  saveGeneratedThumbnail,
  saveReferenceThumbnail
} from "./thumbnail-generator.storage";

type ThumbnailGenerationRow = Awaited<ReturnType<typeof createThumbnailGeneration>>;

function formatThumbnailGeneration(row: ThumbnailGenerationRow) {
  return {
    id: row.id,
    input: {
      title: row.inputTitle,
      description: row.inputDescription,
      context: row.inputContext
    },
    output: {
      title: row.outputTitle,
      textDescription: row.outputTextDescription,
      context: row.outputContext,
      assets: JSON.parse(row.assets) as unknown[],
      designBrief: row.designBrief,
      styleFromReferences: row.styleFromReferences
    },
    references: {
      count: (JSON.parse(row.referencePaths) as string[]).length,
      paths: JSON.parse(row.referencePaths) as string[]
    },
    generatedImage: row.generatedImagePath
      ? {
          mimeType: row.generatedMimeType,
          fileSizeBytes: row.generatedFileSizeBytes,
          downloadUrl: `/utilities/thumbnail-generator/${row.id}/image`
        }
      : null,
    createdAt: row.createdAt.toISOString()
  };
}

export async function generateThumbnailPlan(
  userId: string,
  input: {
    title: string;
    description: string;
    context?: string;
    referenceFiles: Array<{
      buffer: Buffer;
      mimetype: string;
      originalname: string;
    }>;
  }
) {
  const references: ThumbnailReferenceImage[] = input.referenceFiles.map((file) => ({
    buffer: file.buffer,
    mimetype: file.mimetype
  }));

  const plan = await analyzeThumbnailReferences({
    title: input.title,
    description: input.description,
    context: input.context,
    references
  });

  const generationId = randomUUID();
  const referencePaths = await Promise.all(
    input.referenceFiles.map((file, index) =>
      saveReferenceThumbnail({
        generationId,
        index: index + 1,
        fileBuffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype
      })
    )
  );

  let generatedImagePath: string | null = null;
  let generatedMimeType: string | null = null;
  let generatedFileSizeBytes: number | null = null;

  const generatedImage = await generateThumbnailImage(plan, references);
  if (generatedImage) {
    generatedImagePath = await saveGeneratedThumbnail({
      generationId,
      fileBuffer: generatedImage.buffer,
      mimetype: generatedImage.mimetype
    });
    generatedMimeType = generatedImage.mimetype;
    generatedFileSizeBytes = generatedImage.buffer.length;
  }

  const row = await createThumbnailGeneration({
    userId,
    inputTitle: input.title,
    inputDescription: input.description,
    inputContext: input.context,
    referencePaths,
    outputTitle: plan.title,
    outputTextDescription: plan.textDescription,
    outputContext: plan.context,
    assets: plan.assets,
    designBrief: plan.designBrief,
    styleFromReferences: plan.styleFromReferences,
    generatedImagePath,
    generatedMimeType,
    generatedFileSizeBytes
  });

  return formatThumbnailGeneration(row);
}

export async function getThumbnailGeneration(id: string, userId: string) {
  const row = await findThumbnailGenerationById(id);
  if (!row) {
    throw new HttpError(404, "Thumbnail generation not found");
  }
  if (row.userId !== userId) {
    throw new HttpError(403, "Not allowed to view this thumbnail generation");
  }
  return formatThumbnailGeneration(row);
}

export async function listMyThumbnailGenerations(params: {
  userId: string;
  page?: number;
  pageSize?: number;
}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const { items, total } = await listThumbnailGenerationsByUser({
    userId: params.userId,
    page,
    pageSize
  });

  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    items: items.map(formatThumbnailGeneration),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages
    }
  };
}

export async function resolveGeneratedThumbnailDownload(id: string, userId: string) {
  const row = await findThumbnailGenerationById(id);
  if (!row) {
    throw new HttpError(404, "Thumbnail generation not found");
  }
  if (row.userId !== userId) {
    throw new HttpError(403, "Not allowed to view this thumbnail generation");
  }
  if (!row.generatedImagePath) {
    throw new HttpError(404, "No generated image for this thumbnail");
  }

  return {
    stream: await openThumbnailReadStream(row.generatedImagePath),
    mimeType: row.generatedMimeType ?? "image/png"
  };
}
