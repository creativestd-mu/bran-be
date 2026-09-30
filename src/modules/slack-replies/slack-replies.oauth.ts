import jwt from "jsonwebtoken";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";

const PURPOSE = "slack_reply_tracking_connect";

export function buildSlackOAuthState(userId: string): string {
  if (!env.jwtSecret) throw new HttpError(500, "JWT_SECRET is required for OAuth state signing");
  return jwt.sign({ userId, purpose: PURPOSE }, env.jwtSecret, { expiresIn: "15m" });
}

export function verifySlackOAuthState(state: string): string {
  if (!env.jwtSecret) throw new HttpError(500, "JWT_SECRET is required for OAuth state verification");
  try {
    const payload = jwt.verify(state, env.jwtSecret) as { userId?: string; purpose?: string };
    if (!payload.userId || payload.purpose !== PURPOSE) throw new Error("invalid purpose");
    return payload.userId;
  } catch {
    throw new HttpError(400, "Invalid or expired OAuth state");
  }
}

function assertConfigured(): void {
  if (!env.slackClientId || !env.slackClientSecret || !env.slackOAuthRedirectUri) {
    throw new HttpError(500, "Slack OAuth is not configured");
  }
}

export function buildSlackAuthorizationUrl(state: string): string {
  assertConfigured();
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", env.slackClientId);
  url.searchParams.set("redirect_uri", env.slackOAuthRedirectUri);
  url.searchParams.set("user_scope", env.slackUserScopes.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeSlackCode(code: string): Promise<{
  accessToken: string;
  slackUserId: string;
  teamId: string | null;
  teamName: string | null;
  scopes: string | null;
}> {
  assertConfigured();
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.slackClientId,
      client_secret: env.slackClientSecret,
      code,
      redirect_uri: env.slackOAuthRedirectUri
    })
  });
  const data = (await response.json()) as {
    ok?: boolean;
    error?: string;
    authed_user?: { id?: string; access_token?: string; scope?: string };
    team?: { id?: string; name?: string };
  };
  if (!data.ok || !data.authed_user?.id || !data.authed_user.access_token) {
    throw new HttpError(400, `Slack authorization failed: ${data.error ?? "missing user token"}`);
  }
  return {
    accessToken: data.authed_user.access_token,
    slackUserId: data.authed_user.id,
    teamId: data.team?.id ?? null,
    teamName: data.team?.name ?? null,
    scopes: data.authed_user.scope ?? null
  };
}
