import { env } from "../../config/env";
import { isSupportedAudioMime } from "../ai/ai.sarvam";
import type { SlackFile } from "../escalation/escalation.slack";

export const MAX_SLACK_VOICE_BYTES = 25 * 1024 * 1024;

const AUDIO_FILETYPES = new Set([
  "m4a",
  "mp4",
  "mp3",
  "mpeg",
  "webm",
  "wav",
  "ogg",
  "opus",
  "flac",
  "aac",
  "amr"
]);

export type SlackAudioAttachment = {
  id: string;
  name: string;
  mimetype: string;
  urlPrivate: string;
  size?: number;
};

export type SlackAudioBytes = {
  id: string;
  name: string;
  mimetype: string;
  buffer: Buffer;
};

function normalizeMime(file: SlackFile): string {
  const mime = (file.mimetype ?? "").toLowerCase().trim();
  if (mime) return mime;

  const filetype = (file.filetype ?? "").toLowerCase().trim();
  switch (filetype) {
    case "m4a":
      return "audio/mp4";
    case "mp4":
      return "audio/mp4";
    case "mp3":
    case "mpeg":
      return "audio/mpeg";
    case "webm":
      return "audio/webm";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "opus":
      return "audio/opus";
    case "flac":
      return "audio/flac";
    case "aac":
      return "audio/aac";
    case "amr":
      return "audio/amr";
    default:
      return "";
  }
}

export function isSlackAudioFile(file: SlackFile): boolean {
  const mime = normalizeMime(file);
  if (mime && (mime.startsWith("audio/") || mime === "video/webm" || mime === "video/mp4")) {
    return Boolean(file.url_private || file.url_private_download);
  }

  const filetype = (file.filetype ?? "").toLowerCase();
  return AUDIO_FILETYPES.has(filetype) && Boolean(file.url_private || file.url_private_download);
}

export function extractSlackAudioAttachments(
  files: SlackFile[] | undefined
): SlackAudioAttachment[] {
  if (!files?.length) return [];

  return files
    .filter(isSlackAudioFile)
    .slice(0, 1)
    .map((file) => ({
      id: file.id,
      name: file.name || file.title || `${file.id}.m4a`,
      mimetype: normalizeMime(file) || "audio/mp4",
      urlPrivate: file.url_private_download || file.url_private || "",
      size: typeof file.size === "number" ? file.size : undefined
    }))
    .filter((file) => file.urlPrivate);
}

export function hasSlackAudioFiles(files: SlackFile[] | undefined): boolean {
  return extractSlackAudioAttachments(files).length > 0;
}

export async function downloadSlackAudio(
  attachment: SlackAudioAttachment
): Promise<SlackAudioBytes | null> {
  if (!env.slackBotToken) return null;

  if (attachment.size != null && attachment.size > MAX_SLACK_VOICE_BYTES) {
    console.warn("[work.slack-voice] audio too large (declared size)", {
      id: attachment.id,
      size: attachment.size
    });
    return null;
  }

  try {
    const response = await fetch(attachment.urlPrivate, {
      headers: { Authorization: `Bearer ${env.slackBotToken}` }
    });
    if (!response.ok) {
      console.error("[work.slack-voice] audio download failed", {
        id: attachment.id,
        status: response.status
      });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) return null;
    if (buffer.length > MAX_SLACK_VOICE_BYTES) {
      console.warn("[work.slack-voice] audio too large after download", {
        id: attachment.id,
        size: buffer.length
      });
      return null;
    }

    let mimetype = attachment.mimetype.toLowerCase();
    if (!isSupportedAudioMime(mimetype)) {
      // Slack voice notes are usually m4a/mp4; coerce unknown-but-audio to audio/mp4.
      if (mimetype.startsWith("audio/") || mimetype === "video/mp4") {
        mimetype = "audio/mp4";
      } else if (!isSupportedAudioMime(mimetype)) {
        console.warn("[work.slack-voice] unsupported audio mime", {
          id: attachment.id,
          mimetype
        });
        return null;
      }
    }

    return {
      id: attachment.id,
      name: attachment.name,
      mimetype,
      buffer
    };
  } catch (error) {
    console.error("[work.slack-voice] audio download error", { id: attachment.id, error });
    return null;
  }
}

export function isSlackDmChannel(channelId: string, channelType?: string): boolean {
  return channelType === "im" || channelId.startsWith("D");
}

export function isAcceptAsIsConfirmReply(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized === "create" || normalized === "ok" || normalized === "yes";
}
