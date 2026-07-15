import dotenv from "dotenv";

dotenv.config({ quiet: true });

const rawPort = process.env.PORT ?? "3000";
const parsedPort = Number(rawPort);

if (Number.isNaN(parsedPort)) {
  throw new Error("PORT must be a valid number");
}

function buildDatabaseUrlFromParts(): string {
  const host = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT;
  const dbName = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const sslMode = process.env.DB_SSLMODE;

  if (!host || !dbPort || !dbName || !user || !password) {
    return "";
  }

  const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  const baseUrl = `postgresql://${credentials}@${host}:${dbPort}/${dbName}`;
  return sslMode ? `${baseUrl}?sslmode=${encodeURIComponent(sslMode)}` : baseUrl;
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parsedPort,
  databaseUrl: buildDatabaseUrlFromParts() || process.env.DATABASE_URL || "",
  meltwaterBaseUrl: process.env.MELTWATER_BASE_URL ?? "",
  meltwaterApiKey: process.env.MELTWATER_API_KEY ?? "",
  meltwaterOwnedPostsEndpoint:
    process.env.MELTWATER_OWNED_POSTS_ENDPOINT ??
    process.env.MELTWATER_INSTAGRAM_ENDPOINT ??
    "/v3/owned/accounts/posts/top_posts",
  meltwaterAccountIdsInstagram: (() => {
    const direct = parseCsv(process.env.MELTWATER_ACCOUNT_IDS_INSTAGRAM);
    return direct.length > 0 ? direct : parseCsv(process.env.MELTWATER_ACCOUNT_IDS);
  })(),
  meltwaterAccountIdsLinkedin: parseCsv(process.env.MELTWATER_ACCOUNT_IDS_LINKEDIN),
  meltwaterAccountIdsYoutube: parseCsv(process.env.MELTWATER_ACCOUNT_IDS_YOUTUBE),
  meltwaterAccountIdsFacebook: parseCsv(process.env.MELTWATER_ACCOUNT_IDS_FACEBOOK),
  supportedLanguages: (process.env.SUPPORTED_LANGUAGES ?? "en")
    .split(",")
    .map((lang) => lang.trim().toLowerCase())
    .filter(Boolean),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientIds: (() => {
    const fromCsv = parseCsv(process.env.GOOGLE_CLIENT_IDS);
    if (fromCsv.length > 0) {
      return fromCsv;
    }
    return process.env.GOOGLE_CLIENT_ID ? [process.env.GOOGLE_CLIENT_ID] : [];
  })(),
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleOAuthRedirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? "",
  googleCalendarScopes: parseCsv(
    process.env.GOOGLE_CALENDAR_SCOPES ??
      "https://www.googleapis.com/auth/calendar.events.readonly,openid,email,profile"
  ),
  recallApiKey: process.env.RECALL_API_KEY ?? "",
  recallApiRegion: process.env.RECALL_API_REGION ?? "us-east-1",
  recallWebhookSecret: process.env.RECALL_WEBHOOK_SECRET ?? "",
  meetingBotName: process.env.MEETING_BOT_NAME ?? "Bran Notetaker",
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  aiProvider: process.env.AI_PROVIDER ?? "gemini",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  geminiImageModel: process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.0-flash-preview-image-generation",
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001",
  qdrantUrl: process.env.QDRANT_URL ?? "",
  qdrantApiKey: process.env.QDRANT_API_KEY ?? "",
  sarvamApiKey: process.env.SARVAM_API_KEY ?? "",
  audioStorageDir: process.env.AUDIO_STORAGE_DIR ?? "data/audio",
  visionStorageDir: process.env.VISION_STORAGE_DIR ?? "data/visions",
  thumbnailStorageDir: process.env.THUMBNAIL_STORAGE_DIR ?? "data/thumbnails",
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3Region: process.env.S3_REGION ?? "auto",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  s3ForcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "false").toLowerCase() === "true",
  s3AudioPrefix: process.env.S3_AUDIO_PREFIX ?? "audio",
  s3VisionPrefix: process.env.S3_VISION_PREFIX ?? "visions",
  s3ThumbnailPrefix: process.env.S3_THUMBNAIL_PREFIX ?? "thumbnails",
  ideaMatchTopK: parsePositiveNumber(process.env.IDEA_MATCH_TOP_K, 25),
  ideaMatchThreshold: parsePositiveNumber(process.env.IDEA_MATCH_THRESHOLD, 0.6),
  ideaMatchMaxRecommendations: parsePositiveNumber(process.env.IDEA_MATCH_MAX_RECOMMENDATIONS, 5),
  ideaNotifyThreshold: parsePositiveNumber(process.env.IDEA_NOTIFY_THRESHOLD, 0.75),
  aiQueryCacheTtlMinutes: parsePositiveNumber(process.env.AI_QUERY_CACHE_TTL_MINUTES, 10),
  aiQueryCacheSemanticThreshold: parsePositiveNumber(
    process.env.AI_QUERY_CACHE_SEMANTIC_THRESHOLD,
    0.92
  ),
  appTimezone: process.env.APP_TIMEZONE ?? "Asia/Kolkata",
  apifyToken: process.env.APIFY_TOKEN ?? "",
  apifyInstagramActorId: process.env.APIFY_INSTAGRAM_ACTOR_ID ?? "apify/instagram-post-scraper",
  youtubeApiKey: process.env.YOUTUBE_API_KEY ?? "",
  instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN ?? "",
  appUrl: process.env.APP_URL ?? "",
  notificationsAdminEmail: process.env.NOTIFICATIONS_ADMIN_EMAIL ?? "admin@bran.app",
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? "587") || 587,
    secure: (process.env.SMTP_SECURE ?? "false").toLowerCase() === "true",
    user: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
    from: process.env.SMTP_FROM ?? ""
  },
  // Attendance / ETA tracker (Slack)
  slackBotToken: process.env.SLACK_BOT_TOKEN ?? "",
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET ?? "",
  slackChannelName: process.env.SLACK_CHANNEL_NAME ?? "cs-day-off",
  slackChannelId: process.env.SLACK_CHANNEL_ID ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  attendanceEmailDomain: process.env.ATTENDANCE_EMAIL_DOMAIN ?? "mastersunion.org",
  attendanceCronEnabled: (process.env.ATTENDANCE_CRON_ENABLED ?? "true").toLowerCase() !== "false",
  meetingsSyncCronEnabled:
    (process.env.MEETINGS_SYNC_CRON_ENABLED ?? "true").toLowerCase() !== "false",
  meetingsSyncIntervalMs: Number(process.env.MEETINGS_SYNC_INTERVAL_MS ?? 5 * 60 * 1000)
};
