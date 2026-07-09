/**
 * One-off script: onboard the Socials team.
 * Run with: npx tsx prisma/onboard-socials-team.ts
 *
 * - Finds Sudipto Adhicary (already exists) and uses him as manager.
 * - Creates any missing roles with basic content_creator-level permissions.
 * - Upserts all team members, skipping anyone already present.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASIC_PERMISSIONS = ["create_tasks", "manage_ideation", "query_ai", "view_reports"];

const NEW_ROLES: { name: string; description: string }[] = [
  { name: "head_of_socials", description: "Head of Socials" },
  { name: "executive", description: "Executive – basic content access" },
  { name: "intern", description: "Intern – basic content access" },
  { name: "associate", description: "Associate – basic content access" },
  { name: "team_lead", description: "Team Lead – basic content access" }
];

const TEAM_MEMBERS: {
  name: string;
  email: string;
  designation: string;
  roleName: string;
}[] = [
  {
    name: "Arijit Bose",
    email: "arijit.bose@mastersunion.org",
    designation: "Executive - Video Editor",
    roleName: "executive"
  },
  {
    name: "Ayushi Kothari",
    email: "ayushi.kothari@mastersunion.org",
    designation: "Manager",
    roleName: "manager"
  },
  {
    name: "Khushi Nahar",
    email: "khushi.nahar@mastersunion.org",
    designation: "Manager",
    roleName: "manager"
  },
  {
    name: "Harpreet Singh",
    email: "harpreet.singh@mastersunion.org",
    designation: "Intern",
    roleName: "intern"
  },
  {
    name: "Prince Koshiya",
    email: "prince.koshiya@mastersunion.org",
    designation: "Intern",
    roleName: "intern"
  },
  {
    name: "Trisha Das",
    email: "trisha.das@mastersunion.org",
    designation: "Intern",
    roleName: "intern"
  },
  {
    name: "Prachi Malik",
    email: "prachi.malik@mastersunion.org",
    designation: "Executive",
    roleName: "executive"
  },
  {
    name: "Samar Ansari",
    email: "samar.ansari@mastersunion.org",
    designation: "Associate",
    roleName: "associate"
  },
  {
    name: "Varchasvi Mahajan",
    email: "varchasvi.mahajan@mastersunion.org",
    designation: "Team Lead",
    roleName: "team_lead"
  },
  {
    name: "Mani Sharma",
    email: "mani.sharma@mastersunion.org",
    designation: "Executive",
    roleName: "executive"
  }
];

async function main() {
  // ── 1. Ensure new roles exist first (needed for Sudipto too) ───────────────
  console.log("Ensuring roles exist...");

  const basicPermissions = await prisma.permission.findMany({
    where: { name: { in: BASIC_PERMISSIONS } }
  });

  const roleMap: Record<string, string> = {};

  for (const roleDef of NEW_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description },
      create: { name: roleDef.name, description: roleDef.description }
    });
    roleMap[role.name] = role.id;

    for (const perm of basicPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id }
        },
        update: {},
        create: { roleId: role.id, permissionId: perm.id }
      });
    }
    console.log(
      `  Role: ${role.name} (${role.id}) — ${basicPermissions.length} basic permissions`
    );
  }

  const existingRoles = await prisma.role.findMany({
    where: { name: { in: ["manager", "content_creator"] } }
  });
  for (const r of existingRoles) {
    roleMap[r.name] = r.id;
  }

  // ── 2. Upsert Sudipto (manager for the team) ──────────────────────────────
  console.log("\nUpserting Sudipto Adhicary (team manager)...");
  const sudiptoRoleId = roleMap["head_of_socials"];
  if (!sudiptoRoleId) throw new Error("head_of_socials role not found after creation");

  const sudipto = await prisma.user.upsert({
    where: { email: "sudipto.adhicary@mastersunion.org" },
    update: {
      name: "Sudipto Adhicary",
      designation: "Head of Socials",
      roleId: sudiptoRoleId,
      isActive: true
    },
    create: {
      email: "sudipto.adhicary@mastersunion.org",
      name: "Sudipto Adhicary",
      designation: "Head of Socials",
      roleId: sudiptoRoleId,
      isActive: true
    }
  });
  console.log(`  ${sudipto.name} (${sudipto.id})`);

  // ── 3. Upsert team members ─────────────────────────────────────────────────
  console.log("\nOnboarding team members...");

  for (const member of TEAM_MEMBERS) {
    const roleId = roleMap[member.roleName];
    if (!roleId) {
      console.error(`  ✗ Role not found for ${member.email}: ${member.roleName}`);
      continue;
    }

    const user = await prisma.user.upsert({
      where: { email: member.email },
      update: {
        name: member.name,
        designation: member.designation,
        roleId,
        managerUserId: sudipto.id,
        isActive: true
      },
      create: {
        email: member.email,
        name: member.name,
        designation: member.designation,
        roleId,
        managerUserId: sudipto.id,
        isActive: true
      }
    });

    console.log(
      `  ✓ ${user.name} <${user.email}> — role: ${member.roleName} — id: ${user.id}`
    );
  }

  console.log("\nOnboarding complete.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("Script failed:", e);
    prisma.$disconnect();
    process.exit(1);
  });
