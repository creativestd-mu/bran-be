import { prisma } from "../../lib/prisma";

const keywordInclude = {
  createdBy: { select: { id: true, name: true, email: true } }
} as const;

export function normalizeTranscriptionPhrase(phrase: string): string {
  return phrase.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function listTranscriptionKeywords(filters?: { isActive?: boolean }) {
  return prisma.transcriptionKeyword.findMany({
    where: {
      ...(filters?.isActive === undefined ? {} : { isActive: filters.isActive })
    },
    include: keywordInclude,
    orderBy: [{ phrase: "asc" }]
  });
}

export async function listActiveTranscriptionPhrases(): Promise<string[]> {
  const rows = await prisma.transcriptionKeyword.findMany({
    where: { isActive: true },
    select: { phrase: true },
    orderBy: { phrase: "asc" }
  });
  return rows.map((row) => row.phrase);
}

export async function findTranscriptionKeywordById(id: string) {
  return prisma.transcriptionKeyword.findUnique({
    where: { id },
    include: keywordInclude
  });
}

export async function findTranscriptionKeywordByNormalized(normalized: string) {
  return prisma.transcriptionKeyword.findUnique({
    where: { normalized },
    include: keywordInclude
  });
}

export async function createTranscriptionKeyword(data: {
  phrase: string;
  notes?: string | null;
  createdById?: string | null;
}) {
  const phrase = data.phrase.trim().replace(/\s+/g, " ");
  return prisma.transcriptionKeyword.create({
    data: {
      phrase,
      normalized: normalizeTranscriptionPhrase(phrase),
      notes: data.notes?.trim() || null,
      createdById: data.createdById ?? null
    },
    include: keywordInclude
  });
}

export async function updateTranscriptionKeyword(
  id: string,
  data: {
    phrase?: string;
    notes?: string | null;
    isActive?: boolean;
  }
) {
  const update: {
    phrase?: string;
    normalized?: string;
    notes?: string | null;
    isActive?: boolean;
  } = {};

  if (data.phrase !== undefined) {
    const phrase = data.phrase.trim().replace(/\s+/g, " ");
    update.phrase = phrase;
    update.normalized = normalizeTranscriptionPhrase(phrase);
  }
  if (data.notes !== undefined) {
    update.notes = data.notes?.trim() || null;
  }
  if (data.isActive !== undefined) {
    update.isActive = data.isActive;
  }

  return prisma.transcriptionKeyword.update({
    where: { id },
    data: update,
    include: keywordInclude
  });
}

export async function deleteTranscriptionKeyword(id: string) {
  return prisma.transcriptionKeyword.delete({
    where: { id }
  });
}
