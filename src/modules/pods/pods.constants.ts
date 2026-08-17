export const POD_SOCIAL_KINDS = ["OWNED_IP", "INSPIRATION"] as const;
export type PodSocialKind = (typeof POD_SOCIAL_KINDS)[number];

export const POD_SOCIAL_PLATFORMS = ["YOUTUBE", "X", "INSTAGRAM", "LINKEDIN"] as const;
export type PodSocialPlatform = (typeof POD_SOCIAL_PLATFORMS)[number];

export const POD_ACCOUNT_SYNC_STATUSES = ["SUCCESS", "ERROR", "SKIPPED"] as const;
export type PodAccountSyncStatus = (typeof POD_ACCOUNT_SYNC_STATUSES)[number];

export const POD_SOCIAL_SYNC_CRON_HOUR_IST = 8;
