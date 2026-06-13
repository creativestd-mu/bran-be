import { z } from "zod";

import { VOICE_RECORDING_SOURCES } from "./voice-recording.constants";

export const listVoiceRecordingsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  source: z.enum(VOICE_RECORDING_SOURCES).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional()
});
