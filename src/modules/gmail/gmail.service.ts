import type { Request, Response } from "express";

import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../utils/httpError";
import {
  GMAIL_SYNC_CONCURRENCY,
  GMAIL_SYNCABLE_STATUSES
} from "./gmail.constants";
import {
  fetchGmailMessage,
  fetchGmailProfile,
  listGmailHistoryMessageIds,
  listRecentGmailMessages,
  mapWithConcurrency
} from "./gmail.client";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "./gmail.crypto";
import {
  buildGmailAuthorizationUrl,
  buildGmailOAuthState,
  exchangeGmailAuthCode,
  revokeGmailRefreshToken,
  verifyGmailOAuthState
} from "./gmail-oauth.client";
import {
  deleteGmailConnection,
  findGmailConnectionByUserId,
  formatGmailMessageResponse,
  listGmailMessagesForUser,
  listSyncableGmailConnections,
  updateGmailConnection,
  upsertGmailConnection,
  upsertGmailMessage
} from "./gmail.repository";

function redirectToApp(path: string, res: Response): void {
  const base = env.appUrl || "http://localhost:3000";
  res.redirect(`${base.replace(/\/$/, "")}${path}`);
}

function formatConnectionResponse(connection: {
  status: string;
  oauthEmail: string | null;
  connectedAt: Date;
  lastSyncedAt: Date | null;
  errorMessage: string | null;
}) {
  return {
    // ERROR still means a grant exists — UI can show "retry sync".
    connected: connection.status === "CONNECTED" || connection.status === "ERROR",
    status: connection.status,
    oauthEmail: connection.oauthEmail,
    connectedAt: connection.connectedAt.toISOString(),
    lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
    errorMessage: connection.errorMessage
  };
}

function isSyncableStatus(status: string): boolean {
  return (GMAIL_SYNCABLE_STATUSES as readonly string[]).includes(status);
}

async function resolvePlainRefreshToken(connection: {
  userId: string;
  refreshToken: string;
}): Promise<string> {
  const plain = decryptSecret(connection.refreshToken);
  // Re-encrypt legacy plaintext tokens on first use.
  if (!isEncryptedSecret(connection.refreshToken)) {
    await updateGmailConnection(connection.userId, {
      refreshToken: encryptSecret(plain)
    });
  }
  return plain;
}

export async function startGmailConnect(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new HttpError(403, "Account is deactivated");
  }

  // Fail fast if encryption key is missing — never store plaintext tokens.
  encryptSecret("probe");

  const state = buildGmailOAuthState(userId);
  return {
    authorizationUrl: buildGmailAuthorizationUrl(state)
  };
}

export async function handleGmailOAuthCallback(req: Request, res: Response): Promise<void> {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const oauthError = typeof req.query.error === "string" ? req.query.error : null;

    if (oauthError) {
      redirectToApp("/gmail?gmail=error&message=access_denied", res);
      return;
    }

    if (!code || !state) {
      redirectToApp("/gmail?gmail=error&message=missing_oauth_params", res);
      return;
    }

    const userId = verifyGmailOAuthState(state);
    const { refreshToken, email } = await exchangeGmailAuthCode(code);
    const profile = await fetchGmailProfile(refreshToken);

    // Leave historyId null so the first sync backfills recent mail, then
    // advances the cursor. Setting the tip here would sync zero messages.
    await upsertGmailConnection({
      userId,
      refreshToken: encryptSecret(refreshToken),
      oauthEmail: email ?? profile.emailAddress,
      historyId: null,
      status: "CONNECTED"
    });

    scheduleInitialGmailSync(userId);

    redirectToApp("/gmail?gmail=connected", res);
  } catch (error) {
    console.error("[gmail] OAuth callback failed:", error);
    redirectToApp("/gmail?gmail=error&message=connect_failed", res);
  }
}

export async function getGmailStatus(userId: string) {
  const connection = await findGmailConnectionByUserId(userId);
  if (!connection) {
    return { connected: false };
  }

  return formatConnectionResponse(connection);
}

export async function disconnectGmail(userId: string) {
  const connection = await findGmailConnectionByUserId(userId);
  if (!connection) {
    throw new HttpError(404, "No Gmail connection found");
  }

  try {
    const plain = decryptSecret(connection.refreshToken);
    await revokeGmailRefreshToken(plain);
  } catch (error) {
    console.warn("[gmail] Token revoke skipped:", error);
  }

  await deleteGmailConnection(userId);
  return { disconnected: true };
}

export async function listGmailMessages(
  userId: string,
  options?: { limit?: number; q?: string }
) {
  const messages = await listGmailMessagesForUser(userId, options);
  return messages.map(formatGmailMessageResponse);
}

export async function syncGmailForUser(userId: string): Promise<{
  synced: number;
  messages: ReturnType<typeof formatGmailMessageResponse>[];
}> {
  const connection = await findGmailConnectionByUserId(userId);
  if (!connection || !isSyncableStatus(connection.status)) {
    throw new HttpError(400, "Connect Gmail first to sync messages");
  }

  const synced = await syncGmailConnection({
    id: connection.id,
    userId: connection.userId,
    refreshToken: connection.refreshToken,
    historyId: connection.historyId,
    forceRecent: !connection.historyId
  });
  const messages = await listGmailMessages(userId, { limit: 50 });
  return { synced, messages };
}

async function syncGmailConnection(input: {
  id: string;
  userId: string;
  refreshToken: string;
  historyId: string | null;
  forceRecent?: boolean;
}): Promise<number> {
  const connection = await prisma.gmailConnection.findUnique({ where: { id: input.id } });
  if (!connection || !isSyncableStatus(connection.status)) {
    return 0;
  }

  try {
    const refreshToken = await resolvePlainRefreshToken(connection);
    const maxMessages = env.gmailSyncMaxMessages;
    let messageIds: string[] = [];
    let nextHistoryId: string | null = connection.historyId;

    if (!input.forceRecent && connection.historyId) {
      try {
        const history = await listGmailHistoryMessageIds(refreshToken, connection.historyId, {
          maxResults: maxMessages
        });
        messageIds = history.messageIds;
        nextHistoryId = history.historyId ?? connection.historyId;
      } catch {
        // historyId expired or invalid — fall back to a recent full sync
        messageIds = await listRecentGmailMessages(refreshToken, {
          maxResults: maxMessages,
          query: `newer_than:${env.gmailSyncDays}d`
        });
        const profile = await fetchGmailProfile(refreshToken);
        nextHistoryId = profile.historyId;
      }
    } else {
      messageIds = await listRecentGmailMessages(refreshToken, {
        maxResults: maxMessages,
        query: `newer_than:${env.gmailSyncDays}d`
      });
      const profile = await fetchGmailProfile(refreshToken);
      nextHistoryId = profile.historyId;
    }

    let synced = 0;
    const results = await mapWithConcurrency(
      messageIds,
      GMAIL_SYNC_CONCURRENCY,
      async (messageId) => {
        try {
          const parsed = await fetchGmailMessage(refreshToken, messageId);
          if (!parsed.gmailMessageId) return false;
          await upsertGmailMessage(connection.id, parsed);
          return true;
        } catch (error) {
          console.warn(`[gmail] Failed to fetch message ${messageId}:`, error);
          return false;
        }
      }
    );
    synced = results.filter(Boolean).length;

    await updateGmailConnection(connection.userId, {
      historyId: nextHistoryId,
      lastSyncedAt: new Date(),
      status: "CONNECTED",
      errorMessage: null
    });

    return synced;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail sync failed";
    await updateGmailConnection(connection.userId, {
      status: "ERROR",
      errorMessage: message.slice(0, 2000)
    });
    throw error;
  }
}

function scheduleInitialGmailSync(userId: string): void {
  // First attempt immediately (historyId is null → recent backfill).
  // One short retry covers Google eventual consistency right after consent.
  const delaysMs = [0, 20_000];
  for (const delay of delaysMs) {
    const timer = setTimeout(() => {
      void syncGmailForUser(userId).catch((error) => {
        console.error(`[gmail] Initial sync failed for user ${userId}:`, error);
      });
    }, delay);
    if (typeof timer === "object" && timer && "unref" in timer) {
      timer.unref();
    }
  }
}

export async function syncAllConnectedGmailAccounts(): Promise<{
  accounts: number;
  synced: number;
  failures: number;
}> {
  const connections = await listSyncableGmailConnections();
  let synced = 0;
  let failures = 0;

  for (const connection of connections) {
    try {
      synced += await syncGmailConnection({
        id: connection.id,
        userId: connection.userId,
        refreshToken: connection.refreshToken,
        historyId: connection.historyId,
        forceRecent: !connection.historyId
      });
    } catch (error) {
      failures += 1;
      console.error(`[gmail] Cron sync failed for user ${connection.userId}:`, error);
    }
  }

  return { accounts: connections.length, synced, failures };
}
