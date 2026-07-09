export const VOICE_RECORDING_SOURCES = ["work", "ai_translate", "meeting"] as const;
export type VoiceRecordingSource = (typeof VOICE_RECORDING_SOURCES)[number];

export const VOICE_RECORDING_STATUSES = ["COMPLETED", "FAILED"] as const;
export type VoiceRecordingStatus = (typeof VOICE_RECORDING_STATUSES)[number];
