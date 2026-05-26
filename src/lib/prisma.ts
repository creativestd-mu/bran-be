import { PrismaClient } from "@prisma/client";

import { env } from "../config/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const datasourceUrl = env.databaseUrl;
if (!datasourceUrl) {
  throw new Error("Database URL is not configured. Set DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD.");
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
    datasources: {
      db: {
        url: datasourceUrl
      }
    }
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
