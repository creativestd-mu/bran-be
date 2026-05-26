import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { prisma } from "../../lib/prisma";

const googleClient = new OAuth2Client();

interface GooglePayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

interface JwtPayload {
  userId: string;
  email: string;
  roleId: string;
  roleName: string;
}

async function verifyGoogleToken(idToken: string): Promise<GooglePayload> {
  if (env.googleClientIds.length === 0) {
    throw new HttpError(
      500,
      "Google auth is not configured. Set GOOGLE_CLIENT_ID or GOOGLE_CLIENT_IDS."
    );
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.googleClientIds
    });
  } catch {
    throw new HttpError(
      401,
      "Invalid Google token audience. Ensure frontend Google client ID is allowed in backend env."
    );
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email || !payload.name) {
    throw new HttpError(401, "Invalid Google token payload");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture
  };
}

function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"]
  });
}

export function verifyJwt(token: string): JwtPayload {
  try {
    return jwt.verify(token, env.jwtSecret) as JwtPayload;
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
}

function buildAuthResponse(user: { id: string; email: string; name: string; avatarUrl: string | null; roleId: string; role: { name: string } }) {
  const token = signJwt({
    userId: user.id,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role.name
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role.name
    }
  };
}

export async function googleSignIn(idToken: string) {
  const googlePayload = await verifyGoogleToken(idToken);

  let user = await prisma.user.findFirst({
    where: { googleId: googlePayload.sub },
    include: { role: true }
  });

  if (!user) {
    // Allow admin-precreated users to login via Google by matching email first.
    const userByEmail = await prisma.user.findUnique({
      where: { email: googlePayload.email },
      include: { role: true }
    });

    if (userByEmail) {
      user = await prisma.user.update({
        where: { id: userByEmail.id },
        data: {
          googleId: googlePayload.sub,
          name: userByEmail.name || googlePayload.name,
          avatarUrl: googlePayload.picture ?? userByEmail.avatarUrl ?? null,
          lastLoginAt: new Date()
        },
        include: { role: true }
      });
    } else {
      const defaultRole = await prisma.role.findUnique({
        where: { name: "content_creator" }
      });

      if (!defaultRole) {
        throw new HttpError(500, "Default role not found. Please run database seed.");
      }

      user = await prisma.user.create({
        data: {
          googleId: googlePayload.sub,
          email: googlePayload.email,
          name: googlePayload.name,
          avatarUrl: googlePayload.picture ?? null,
          roleId: defaultRole.id,
          lastLoginAt: new Date()
        },
        include: { role: true }
      });
    }
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      include: { role: true }
    });
  }

  if (!user.isActive) {
    throw new HttpError(403, "Account is deactivated");
  }

  return buildAuthResponse(user);
}

export async function emailPasswordLogin(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true }
  });

  if (!user || !user.passwordHash) {
    throw new HttpError(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, "Invalid email or password");
  }

  if (!user.isActive) {
    throw new HttpError(403, "Account is deactivated");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  return buildAuthResponse(user);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
