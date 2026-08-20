/** Default reminder slots in IST (HH:mm). */
export const DEFAULT_REVIEW_REMINDER_TIMES = ["11:00", "18:00"] as const;

export const REVIEW_ACCEPT_ACTION = "review_accept";
export const REVIEW_REJECT_ACTION = "review_reject";
export const REVIEW_RESPONSE_CALLBACK_ID = "review_response_modal";
export const REVIEW_COMMENT_BLOCK_ID = "review_comment_block";
export const REVIEW_COMMENT_ACTION_ID = "review_comment_input";

/** Max upload size for review attachments (25 MB). */
export const MAX_REVIEW_FILE_BYTES = 25 * 1024 * 1024;

export const REVIEW_TIMEZONE = "Asia/Kolkata";
