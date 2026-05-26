import FormData from "form-data";
import https from "node:https";
import http from "node:http";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";

export type SarvamTranslateResult = {
  requestId: string | null;
  transcript: string;
  languageCode: string | null;
  languageProbability: number | null;
};

type SarvamSuccessResponse = {
  request_id: string | null;
  transcript: string;
  language_code: string | null;
  language_probability: number | null;
};

type SarvamErrorResponse = {
  error: {
    request_id: string | null;
    message: string;
    code: string;
  };
};

const SARVAM_ENDPOINT = "https://api.sarvam.ai/speech-to-text-translate";

const SUPPORTED_MIME_TYPES = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mpeg",
  "audio/mp3",
  "audio/aac",
  "audio/aiff",
  "audio/ogg",
  "audio/opus",
  "audio/flac",
  "audio/x-flac",
  "audio/mp4",
  "audio/x-m4a",
  "audio/amr",
  "audio/webm",
  "video/webm",
  "video/mp4"
]);

export function isSupportedAudioMime(mimetype: string): boolean {
  return SUPPORTED_MIME_TYPES.has(mimetype.toLowerCase());
}

function postFormData(
  url: string,
  form: FormData,
  headers: Record<string, string>
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const formHeaders = form.getHeaders();
    const allHeaders = { ...formHeaders, ...headers };

    const parsedUrl = new URL(url);
    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname,
      method: "POST",
      headers: allHeaders
    };

    const transport = parsedUrl.protocol === "https:" ? https : http;
    const req = transport.request(options, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });
      res.on("end", () => {
        resolve({ status: res.statusCode ?? 0, body: data });
      });
    });

    req.on("error", reject);

    form.pipe(req);
  });
}

export async function translateAudioWithSarvam(params: {
  fileBuffer: Buffer;
  originalname: string;
  mimetype: string;
  prompt?: string;
}): Promise<SarvamTranslateResult> {
  const apiKey = env.sarvamApiKey;
  if (!apiKey) {
    throw new HttpError(503, "Sarvam API is not configured. Set SARVAM_API_KEY.");
  }

  if (!isSupportedAudioMime(params.mimetype)) {
    throw new HttpError(
      400,
      `Unsupported audio format: ${params.mimetype}. Supported: WAV, MP3, AAC, OGG, FLAC, MP4, WebM and others.`
    );
  }

  const form = new FormData();
  form.append("file", params.fileBuffer, {
    filename: params.originalname,
    contentType: params.mimetype
  });
  form.append("model", "saaras:v2.5");
  if (params.prompt) {
    form.append("prompt", params.prompt);
  }

  const { status, body } = await postFormData(SARVAM_ENDPOINT, form, {
    "api-subscription-key": apiKey
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new HttpError(502, "Invalid response from Sarvam API");
  }

  if (status === 200) {
    const ok = parsed as SarvamSuccessResponse;
    return {
      requestId: ok.request_id ?? null,
      transcript: ok.transcript,
      languageCode: ok.language_code ?? null,
      languageProbability: ok.language_probability ?? null
    };
  }

  const errBody = parsed as SarvamErrorResponse;
  const message = errBody?.error?.message ?? "Sarvam API error";

  if (status === 400) throw new HttpError(400, message);
  if (status === 403) throw new HttpError(403, "Sarvam API key is invalid or unauthorised");
  if (status === 422) throw new HttpError(422, message);
  if (status === 429) throw new HttpError(429, "Sarvam quota exceeded. Try again later.");

  throw new HttpError(502, `Sarvam API returned status ${status}: ${message}`);
}
