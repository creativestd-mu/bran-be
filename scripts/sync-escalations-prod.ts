/**
 * Trigger escalation sync on production via authenticated API.
 *
 *   npx tsx --env-file=.env scripts/sync-escalations-prod.ts
 */
import jwt from "jsonwebtoken";

import { env } from "../src/config/env";
import { prisma } from "../src/lib/prisma";

const PRODUCTION_URL = "https://bran-be-production-3549.up.railway.app";

async function main() {
  const days = Number(process.argv[2] ?? 30);

  const user = await prisma.user.findFirst({
    where: { role: { name: { in: ["admin", "chief_of_staff"] } } },
    include: { role: true }
  });
  if (!user) {
    throw new Error("No admin or chief_of_staff user found in database");
  }

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name
    },
    env.jwtSecret,
    { expiresIn: "1h" }
  );

  const response = await fetch(`${PRODUCTION_URL}/api/eta/escalations/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ days })
  });

  const body = await response.text();
  console.log(`status ${response.status}`);
  console.log(body);

  if (!response.ok) {
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
