import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";

const OAUTH_STATE_PURPOSE = "google_calendar_connect";

interface OAuthStatePayload {
  userId: string;
  purpose: string;
}

function getOAuthClient(): OAuth2Client {
  const clientId = env.googleClientIds[0];
  if (!clientId || !env.googleClientSecret || !env.googleOAuthRedirectUri) {
    throw new HttpError(
      500,
      "Google Calendar OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI."
    );
  }

  return new OAuth2Client(clientId, env.googleClientSecret, env.googleOAuthRedirectUri);
}

export function buildCalendarOAuthState(userId: string): string {
  if (!env.jwtSecret) {
    throw new HttpError(500, "JWT_SECRET is required for OAuth state signing");
  }

  return jwt.sign({ userId, purpose: OAUTH_STATE_PURPOSE }, env.jwtSecret, {
    expiresIn: "15m"
  });
}

export function verifyCalendarOAuthState(state: string): string {
  if (!env.jwtSecret) {
    throw new HttpError(500, "JWT_SECRET is required for OAuth state verification");
  }

  try {
    const payload = jwt.verify(state, env.jwtSecret) as OAuthStatePayload;
    if (payload.purpose !== OAUTH_STATE_PURPOSE || !payload.userId) {
      throw new HttpError(400, "Invalid OAuth state");
    }
    return payload.userId;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid or expired OAuth state");
  }
}

export function buildCalendarAuthorizationUrl(state: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: env.googleCalendarScopes,
    state
  });
}

export async function exchangeCalendarAuthCode(code: string): Promise<{
  refreshToken: string;
  email?: string;
}> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new HttpError(
      400,
      "Google did not return a refresh token. Re-authorize with consent to enable calendar access."
    );
  }

  let email: string | undefined;
  if (tokens.id_token) {
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.googleClientIds
    });
    email = ticket.getPayload()?.email ?? undefined;
  }

  return {
    refreshToken: tokens.refresh_token,
    email
  };
}
