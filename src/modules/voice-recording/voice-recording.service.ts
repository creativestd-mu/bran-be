import { HttpError } from "../../utils/httpError";
import { translateAudioWithSarvam, type SarvamTranslateResult } from "../ai/ai.sarvam";
import type { VoiceRecordingSource } from "./voice-recording.constants";
import {
  createVoiceRecording,
  findVoiceRecordingById,
  findVoiceRecordings,
  updateVoiceRecording
} from "./voice-recording.repository";
import {
  displayFilename,
  newRecordingId,
  resolveVoiceRecordingAbsolutePath,
  saveVoiceRecordingFile
} from "./voice-recording.storage";

function canViewAll(roleName: string): boolean {
  return roleName === "admin" || roleName === "manager" || roleName === "superadmin";
}

export async function archiveVoiceRecording(params: {
  userId: string;
  source: VoiceRecordingSource;
  fileBuffer: Buffer;
  originalname: string;
  mimetype: string;
  transcript?: string | null;
  sarvam?: SarvamTranslateResult | null;
  status?: "COMPLETED" | "FAILED";
  errorMessage?: string | null;
}) {
  const recordingId = newRecordingId();
  const storagePath = saveVoiceRecordingFile({
    userId: params.userId,
    recordingId,
    fileBuffer: params.fileBuffer,
    originalname: params.originalname,
    mimetype: params.mimetype
  });

  return createVoiceRecording({
    id: recordingId,
    userId: params.userId,
    source: params.source,
    originalFilename: displayFilename(params.originalname),
    mimeType: params.mimetype,
    fileSizeBytes: params.fileBuffer.length,
    storagePath,
    transcript: params.transcript ?? params.sarvam?.transcript ?? null,
    sarvamRequestId: params.sarvam?.requestId ?? null,
    languageCode: params.sarvam?.languageCode ?? null,
    languageProbability: params.sarvam?.languageProbability ?? null,
    status: params.status ?? "COMPLETED",
    errorMessage: params.errorMessage ?? null
  });
}

export async function transcribeAndArchiveVoiceRecording(params: {
  userId: string;
  source: VoiceRecordingSource;
  fileBuffer: Buffer;
  originalname: string;
  mimetype: string;
  prompt?: string;
}) {
  const recordingId = newRecordingId();
  const storagePath = saveVoiceRecordingFile({
    userId: params.userId,
    recordingId,
    fileBuffer: params.fileBuffer,
    originalname: params.originalname,
    mimetype: params.mimetype
  });

  const recording = await createVoiceRecording({
    id: recordingId,
    userId: params.userId,
    source: params.source,
    originalFilename: displayFilename(params.originalname),
    mimeType: params.mimetype,
    fileSizeBytes: params.fileBuffer.length,
    storagePath,
    status: "COMPLETED"
  });

  try {
    const sarvam = await translateAudioWithSarvam({
      fileBuffer: params.fileBuffer,
      originalname: params.originalname,
      mimetype: params.mimetype,
      prompt: params.prompt
    });

    const updated = await updateVoiceRecording(recording.id, {
      transcript: sarvam.transcript,
      sarvamRequestId: sarvam.requestId,
      languageCode: sarvam.languageCode,
      languageProbability: sarvam.languageProbability,
      status: "COMPLETED",
      errorMessage: null
    });

    return { recording: updated, sarvam };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    await updateVoiceRecording(recording.id, {
      status: "FAILED",
      errorMessage: message
    });
    throw error instanceof HttpError ? error : new HttpError(502, message);
  }
}

export async function getVoiceRecordingById(id: string) {
  const recording = await findVoiceRecordingById(id);
  if (!recording) throw new HttpError(404, "Voice recording not found");
  return recording;
}

export function assertCanAccessRecording(
  recording: { userId: string },
  viewerUserId: string,
  viewerRole: string
): void {
  if (recording.userId !== viewerUserId && !canViewAll(viewerRole)) {
    throw new HttpError(403, "Not authorized to access this voice recording");
  }
}

export async function listVoiceRecordingsForViewer(options: {
  viewerUserId: string;
  viewerRole: string;
  userId?: string;
  source?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 20));
  const filterUserId = canViewAll(options.viewerRole) ? options.userId : options.viewerUserId;

  const { items, total } = await findVoiceRecordings({
    userId: filterUserId,
    source: options.source,
    page,
    pageSize
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items,
    pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages }
  };
}

export function getVoiceRecordingFilePath(storagePath: string): string {
  return resolveVoiceRecordingAbsolutePath(storagePath);
}
