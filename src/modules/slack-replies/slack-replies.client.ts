import { HttpError } from "../../utils/httpError";

const SLACK_API = "https://slack.com/api";

type ApiResponse = { ok: boolean; error?: string; response_metadata?: { next_cursor?: string } };

async function slackUserApi<T extends ApiResponse>(
  token: string,
  method: string,
  params: Record<string, string | undefined> = {}
): Promise<T> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) body.set(key, value);
  const response = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = (await response.json()) as T;
  if (!data.ok) throw new HttpError(502, `Slack API ${method} failed: ${data.error ?? "unknown_error"}`);
  return data;
}

export type ReplySlackConversation = {
  id: string;
  name?: string;
  is_im?: boolean;
  is_mpim?: boolean;
  user?: string;
};

export type ReplySlackMessage = {
  ts: string;
  thread_ts?: string;
  user?: string;
  text?: string;
  bot_id?: string;
  subtype?: string;
  reply_count?: number;
  reply_users?: string[];
};

export async function listUserConversations(token: string, max: number): Promise<ReplySlackConversation[]> {
  const output: ReplySlackConversation[] = [];
  let cursor: string | undefined;
  do {
    const data = await slackUserApi<ApiResponse & { channels?: ReplySlackConversation[] }>(
      token,
      "users.conversations",
      { types: "public_channel,private_channel,mpim,im", exclude_archived: "true", limit: "200", cursor }
    );
    output.push(...(data.channels ?? []));
    cursor = output.length >= max ? undefined : data.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return output.slice(0, max);
}

export async function listConversationHistory(
  token: string,
  channelId: string,
  oldest: string,
  max: number
): Promise<ReplySlackMessage[]> {
  const data = await slackUserApi<ApiResponse & { messages?: ReplySlackMessage[] }>(
    token,
    "conversations.history",
    { channel: channelId, oldest, limit: String(Math.min(max, 200)), inclusive: "true" }
  );
  return data.messages ?? [];
}

export async function listThreadReplies(token: string, channelId: string, ts: string): Promise<ReplySlackMessage[]> {
  const data = await slackUserApi<ApiResponse & { messages?: ReplySlackMessage[] }>(
    token,
    "conversations.replies",
    { channel: channelId, ts, limit: "200" }
  );
  return data.messages ?? [];
}

export async function getUserProfile(token: string, userId: string): Promise<{ name: string | null; email: string | null }> {
  const data = await slackUserApi<ApiResponse & {
    user?: { name?: string; real_name?: string; profile?: { display_name?: string; real_name?: string; email?: string } };
  }>(token, "users.info", { user: userId });
  const user = data.user;
  return {
    name: user?.profile?.display_name || user?.profile?.real_name || user?.real_name || user?.name || null,
    email: user?.profile?.email?.trim().toLowerCase() ?? null
  };
}

export async function revokeSlackToken(token: string): Promise<void> {
  await slackUserApi(token, "auth.revoke");
}
