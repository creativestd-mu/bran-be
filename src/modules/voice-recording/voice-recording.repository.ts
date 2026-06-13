import { prisma } from "../../lib/prisma";

const userSelect = { id: true, name: true, email: true } as const;

const workUnitSummaryInclude = {
  user: { select: userSelect },
  steps: { orderBy: { deadline: "asc" as const } }
} as const;

export async function createVoiceRecording(data: {
  id: string;
  userId: string;
  source: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  storagePath: string;
  transcript?: string | null;
  sarvamRequestId?: string | null;
  languageCode?: string | null;
  languageProbability?: number | null;
  status?: string;
  errorMessage?: string | null;
}) {
  return prisma.voiceRecording.create({
    data: {
      id: data.id,
      userId: data.userId,
      source: data.source,
      originalFilename: data.originalFilename,
      mimeType: data.mimeType,
      fileSizeBytes: data.fileSizeBytes,
      storagePath: data.storagePath,
      transcript: data.transcript ?? null,
      sarvamRequestId: data.sarvamRequestId ?? null,
      languageCode: data.languageCode ?? null,
      languageProbability: data.languageProbability ?? null,
      status: data.status ?? "COMPLETED",
      errorMessage: data.errorMessage ?? null
    }
  });
}

export async function updateVoiceRecording(
  id: string,
  data: {
    transcript?: string | null;
    sarvamRequestId?: string | null;
    languageCode?: string | null;
    languageProbability?: number | null;
    status?: string;
    errorMessage?: string | null;
  }
) {
  return prisma.voiceRecording.update({
    where: { id },
    data
  });
}

export async function findVoiceRecordingById(id: string) {
  return prisma.voiceRecording.findUnique({
    where: { id },
    include: {
      user: { select: userSelect },
      workUnits: { include: workUnitSummaryInclude, orderBy: { createdAt: "asc" } }
    }
  });
}

export async function findVoiceRecordings(options: {
  userId?: string;
  source?: string;
  page: number;
  pageSize: number;
}) {
  const where: Record<string, unknown> = {};
  if (options.userId) where.userId = options.userId;
  if (options.source) where.source = options.source;

  const [items, total] = await Promise.all([
    prisma.voiceRecording.findMany({
      where,
      include: {
        user: { select: userSelect },
        workUnits: {
          select: {
            id: true,
            title: true,
            status: true,
            isPrivate: true,
            createdAt: true
          },
          orderBy: { createdAt: "asc" }
        }
      },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      orderBy: { createdAt: "desc" }
    }),
    prisma.voiceRecording.count({ where })
  ]);

  return { items, total };
}
