/**
 * One-off script: onboard the full org roster.
 * Run with: npx tsx prisma/onboard-org-users.ts
 *
 * - Upserts every person with name + designation.
 * - Sets managerUserId to null (no manager for now).
 * - Creates missing designation-based roles with basic permissions.
 * - Preserves elevated roles (admin / superadmin / chief_of_staff) on existing users.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASIC_PERMISSIONS = ["create_tasks", "manage_ideation", "query_ai", "view_reports"];

const PROTECTED_ROLES = new Set(["admin", "superadmin", "chief_of_staff"]);

const NEW_ROLES: { name: string; description: string }[] = [
  { name: "head_of_socials", description: "Head of Socials" },
  { name: "executive", description: "Executive – basic content access" },
  { name: "intern", description: "Intern – basic content access" },
  { name: "associate", description: "Associate – basic content access" },
  { name: "team_lead", description: "Team Lead – basic content access" },
  { name: "senior_manager", description: "Senior Manager – manager-level access" },
  { name: "general_manager", description: "General Manager – manager-level access" },
  { name: "creative_director", description: "Creative Director – manager-level access" },
  { name: "associate_director", description: "Associate Director – manager-level access" },
  { name: "project_manager", description: "Project Manager – manager-level access" },
  { name: "studio_manager", description: "Studio Manager – basic content access" }
];

const MANAGER_LEVEL_ROLES = new Set([
  "manager",
  "senior_manager",
  "general_manager",
  "creative_director",
  "associate_director",
  "project_manager",
  "head_of_socials"
]);

const MANAGER_PERMISSIONS = [
  "view_reports",
  "create_tasks",
  "manage_tasks",
  "query_ai",
  "view_all_tasks",
  "manage_social_accounts",
  "manage_teams",
  "manage_projects",
  "manage_content",
  "approve_resources",
  "manage_ideation",
  "manage_inventory"
];

type OrgUser = {
  name: string;
  email: string;
  designation: string;
  roleName: string;
};

function roleFromDesignation(designation: string): string {
  const d = designation.trim().toLowerCase();

  if (d === "head of socials") return "head_of_socials";
  if (d === "associate director") return "associate_director";
  if (d === "creative director") return "creative_director";
  if (d === "general manager") return "general_manager";
  if (d === "project manager") return "project_manager";
  if (d === "studio manager") return "studio_manager";
  if (d === "team lead") return "team_lead";
  if (d === "intern") return "intern";
  if (d === "manager" || d === "assistant brand manager") return "manager";
  if (d.startsWith("senior manager")) return "senior_manager";
  if (
    d.includes("associate") ||
    d === "visual designer" ||
    d === "senior creative producer"
  ) {
    return "associate";
  }
  if (
    d.includes("executive") ||
    d === "brand executive" ||
    d === "sr executive"
  ) {
    return "executive";
  }

  return "content_creator";
}

const ORG_USERS: OrgUser[] = [
  {
    name: "Divyam Amit Goenka",
    email: "divyam.goenka@mastersunion.org",
    designation: "Associate Director",
    roleName: "associate_director"
  },
  {
    name: "Neha",
    email: "neha1@mastersunion.org",
    designation: "Executive",
    roleName: "executive"
  },
  {
    name: "Daisy Kataria",
    email: "daisy.kataria@mastersunion.org",
    designation: "Executive - Director's Office",
    roleName: "executive"
  },
  {
    name: "Ananya Dengri",
    email: "ananya.dengri@mastersunion.org",
    designation: "Senior Manager - I",
    roleName: "senior_manager"
  },
  {
    name: "Akash P K",
    email: "akash.pk@mastersunion.org",
    designation: "Team Lead",
    roleName: "team_lead"
  },
  {
    name: "Irmeen Ansari",
    email: "irmeen.ansari@mastersunion.org",
    designation: "Brand Executive",
    roleName: "executive"
  },
  {
    name: "Ananya Singh",
    email: "ananya.singh1@mastersunion.org",
    designation: "Senior Executive - Brand",
    roleName: "executive"
  },
  {
    name: "Aryan Popli",
    email: "aryan.popli1@mastersunion.org",
    designation: "Intern",
    roleName: "intern"
  },
  {
    name: "Ayushi Kumari",
    email: "ayushi.kumari@mastersunion.org",
    designation: "Brand Executive",
    roleName: "executive"
  },
  {
    name: "Pragya Rastogi",
    email: "pragya.rastogi@mastersunion.org",
    designation: "Assistant Brand Manager",
    roleName: "manager"
  },
  {
    name: "Arun Rengaswamy",
    email: "arun.rengaswamy@mastersunion.org",
    designation: "General Manager",
    roleName: "general_manager"
  },
  {
    name: "Ishika Aggarwal",
    email: "ishika.aggarwal@mastersunion.org",
    designation: "Senior Manager - I",
    roleName: "senior_manager"
  },
  {
    name: "Abhishek Singh",
    email: "abhishek.singh1@mastersunion.org",
    designation: "Executive",
    roleName: "executive"
  },
  {
    name: "Akshay Shrivastava",
    email: "akshay.shrivastav@mastersunion.org",
    designation: "Associate",
    roleName: "associate"
  },
  {
    name: "Aryan Gupta",
    email: "aryan.gupta@mastersunion.org",
    designation: "Associate",
    roleName: "associate"
  },
  {
    name: "Dhirendra Kumar",
    email: "dhirendra.kumar1@mastersunion.org",
    designation: "Senior Creative Producer",
    roleName: "associate"
  },
  {
    name: "Sabhya Sharma",
    email: "sabhya.sharma@mastersunion.org",
    designation: "Senior Executive",
    roleName: "executive"
  },
  {
    name: "Sonam Kumari",
    email: "sonam.kumari1@mastersunion.org",
    designation: "Creative Associate",
    roleName: "associate"
  },
  {
    name: "Raja Kumar",
    email: "raja.kumar@mastersunion.org",
    designation: "Senior Manager - I",
    roleName: "senior_manager"
  },
  {
    name: "Aryan Sagar",
    email: "aryan.sagar@mastersunion.org",
    designation: "Intern",
    roleName: "intern"
  },
  {
    name: "Nishant Singh",
    email: "nishant.singh2@mastersunion.org",
    designation: "Associate",
    roleName: "associate"
  },
  {
    name: "Pratik Sharma",
    email: "pratik.sharma@mastersunion.org",
    designation: "Executive",
    roleName: "executive"
  },
  {
    name: "Ratnam Kalra",
    email: "ratnam.kalra@mastersunion.org",
    designation: "Senior Manager - I",
    roleName: "senior_manager"
  },
  {
    name: "Sudhanshu Kumar",
    email: "sudhanshu.kumar@mastersunion.org",
    designation: "Executive",
    roleName: "executive"
  },
  {
    name: "Virendra Khimji Rathod",
    email: "virendra.rathod@mastersunion.org",
    designation: "Executive",
    roleName: "executive"
  },
  {
    name: "Sharoz Ali Khan",
    email: "sharoz.khan@mastersunion.org",
    designation: "Senior Executive",
    roleName: "executive"
  },
  {
    name: "Shashank Rai",
    email: "shashank.rai@mastersunion.org",
    designation: "Team Lead",
    roleName: "team_lead"
  },
  {
    name: "Anurag Karmshil",
    email: "anurag.karmshil@mastersunion.org",
    designation: "Associate",
    roleName: "associate"
  },
  {
    name: "Mohd. Shaz Khan",
    email: "shaz.khan@mastersunion.org",
    designation: "Senior Executive",
    roleName: "executive"
  },
  {
    name: "Nitin Garg",
    email: "nitin.garg@mastersunion.org",
    designation: "Senior Executive",
    roleName: "executive"
  },
  {
    name: "Sagnik Ganguly",
    email: "sagnik.ganguly@mastersunion.org",
    designation: "Senior Executive",
    roleName: "executive"
  },
  {
    name: "Sandeep Kumar",
    email: "sandeep.raniwal@mastersunion.org",
    designation: "Senior Executive",
    roleName: "executive"
  },
  {
    name: "Upendra Kumar Byahut",
    email: "upendra.byahut@mastersunion.org",
    designation: "Associate",
    roleName: "associate"
  },
  {
    name: "Ram Kumar",
    email: "ram.kumar@mastersunion.org",
    designation: "Associate",
    roleName: "associate"
  },
  {
    name: "Sharwan Kumar",
    email: "sharwan.kumar@mastersunion.org",
    designation: "Associate",
    roleName: "associate"
  },
  {
    name: "Devansh Harsh Kotak",
    email: "devansh.kotak@mastersunion.org",
    designation: "Senior Manager - I",
    roleName: "senior_manager"
  },
  {
    name: "Abhishek Mishra",
    email: "abhishek.mishra1@mastersunion.org",
    designation: "General Manager",
    roleName: "general_manager"
  },
  {
    name: "Anas Khan",
    email: "anas.khan@mastersunion.org",
    designation: "Associate",
    roleName: "associate"
  },
  {
    name: "Ashok Tirkey",
    email: "ashok.tirkey@mastersunion.org",
    designation: "Associate",
    roleName: "associate"
  },
  {
    name: "Md Zakaullah",
    email: "md.zakaullah@mastersunion.org",
    designation: "Associate",
    roleName: "associate"
  },
  {
    name: "Vikash Pandit",
    email: "vikash.pandit@mastersunion.org",
    designation: "Studio Manager",
    roleName: "studio_manager"
  },
  {
    name: "Eby Manuel",
    email: "eby.manuel@mastersunion.org",
    designation: "Team Lead",
    roleName: "team_lead"
  },
  {
    name: "Gaurang Khanna",
    email: "gaurang.khanna@mastersunion.org",
    designation: "Associate",
    roleName: "associate"
  },
  {
    name: "Mrittika Maitra",
    email: "mrittika.maitra@mastersunion.org",
    designation: "Associate",
    roleName: "associate"
  },
  {
    name: "Tushar Singh",
    email: "tushar.singh1@mastersunion.org",
    designation: "Visual Designer",
    roleName: "associate"
  },
  {
    name: "Soumadip Patra",
    email: "soumadip.patra@mastersunion.org",
    designation: "Team Lead",
    roleName: "team_lead"
  },
  {
    name: "B Bhanu Prakash",
    email: "bhanu.prakash@mastersunion.org",
    designation: "Associate",
    roleName: "associate"
  },
  {
    name: "Joel Anto",
    email: "joel.anto@mastersunion.org",
    designation: "Associate",
    roleName: "associate"
  },
  {
    name: "Mainak Baidya",
    email: "mainak.baidya@mastersunion.org",
    designation: "Executive",
    roleName: "executive"
  },
  {
    name: "Sreejith Padmakumar",
    email: "sreejith.padmakumar@mastersunion.org",
    designation: "Executive",
    roleName: "executive"
  },
  {
    name: "Tapas Mandal",
    email: "tapas.mandal@mastersunion.org",
    designation: "Executive",
    roleName: "executive"
  },
  {
    name: "Swarnim Singh Rokey",
    email: "swarnim.singh@mastersunion.org",
    designation: "Sr Executive",
    roleName: "executive"
  },
  {
    name: "Tejal Dua",
    email: "tejal.dua@mastersunion.org",
    designation: "Creative Associate",
    roleName: "associate"
  },
  {
    name: "Naveen Kumar",
    email: "naveen.kumar@mastersunion.org",
    designation: "Creative Director",
    roleName: "creative_director"
  },
  {
    name: "Pratham Nagpal",
    email: "pratham.nagpal@mastersunion.org",
    designation: "Executive",
    roleName: "executive"
  },
  {
    name: "Spandana Guduru",
    email: "spandana.guduru@mastersunion.org",
    designation: "Senior Executive",
    roleName: "executive"
  },
  {
    name: "Sudeep Purwar",
    email: "sudeep.purwar@mastersunion.org",
    designation: "Manager",
    roleName: "manager"
  },
  {
    name: "Abhishek Ghosh",
    email: "abhishek.ghosh1@mastersunion.org",
    designation: "Intern",
    roleName: "intern"
  },
  {
    name: "Amisha Sharma",
    email: "amisha.sharma@mastersunion.org",
    designation: "Executive - Test Engineer",
    roleName: "executive"
  },
  {
    name: "Dhananjay Jain",
    email: "dhananjay.jain@mastersunion.org",
    designation: "Project Manager",
    roleName: "project_manager"
  },
  {
    name: "Sudipto Adhicary",
    email: "sudipto.adhicary@mastersunion.org",
    designation: "Head of Socials",
    roleName: "head_of_socials"
  },
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
  // Sanity-check role mapping against designations
  for (const user of ORG_USERS) {
    const inferred = roleFromDesignation(user.designation);
    if (inferred !== user.roleName) {
      console.warn(
        `Role mismatch for ${user.email}: designation "${user.designation}" → ${inferred}, listed as ${user.roleName}`
      );
    }
  }

  const emails = ORG_USERS.map((u) => u.email.toLowerCase());
  const uniqueEmails = new Set(emails);
  if (uniqueEmails.size !== emails.length) {
    throw new Error("Duplicate emails in ORG_USERS list");
  }

  console.log(`Onboarding ${ORG_USERS.length} users (managerUserId = null)...\n`);

  console.log("Ensuring roles exist...");
  const basicPermissions = await prisma.permission.findMany({
    where: { name: { in: BASIC_PERMISSIONS } }
  });
  const managerPermissions = await prisma.permission.findMany({
    where: { name: { in: MANAGER_PERMISSIONS } }
  });

  const roleMap: Record<string, string> = {};

  for (const roleDef of NEW_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description },
      create: { name: roleDef.name, description: roleDef.description }
    });
    roleMap[role.name] = role.id;

    const perms = MANAGER_LEVEL_ROLES.has(role.name) ? managerPermissions : basicPermissions;
    for (const perm of perms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id }
        },
        update: {},
        create: { roleId: role.id, permissionId: perm.id }
      });
    }
    console.log(`  Role: ${role.name} — ${perms.length} permissions`);
  }

  const existingRoles = await prisma.role.findMany({
    where: {
      name: {
        in: ["manager", "content_creator", "admin", "superadmin", "chief_of_staff"]
      }
    }
  });
  for (const r of existingRoles) {
    roleMap[r.name] = r.id;
  }

  console.log("\nUpserting users...");
  let created = 0;
  let updated = 0;
  let preservedRole = 0;

  for (const member of ORG_USERS) {
    const roleId = roleMap[member.roleName];
    if (!roleId) {
      console.error(`  ✗ Role not found for ${member.email}: ${member.roleName}`);
      continue;
    }

    const existing = await prisma.user.findUnique({
      where: { email: member.email },
      include: { role: true }
    });

    const keepElevatedRole =
      existing?.role?.name != null && PROTECTED_ROLES.has(existing.role.name);
    const nextRoleId = keepElevatedRole ? existing!.roleId : roleId;

    if (existing) {
      const user = await prisma.user.update({
        where: { email: member.email },
        data: {
          name: member.name,
          designation: member.designation,
          roleId: nextRoleId,
          managerUserId: null,
          isActive: true
        },
        include: { role: true }
      });
      updated += 1;
      if (keepElevatedRole) preservedRole += 1;
      console.log(
        `  ~ ${user.name} <${user.email}> — ${member.designation} — role: ${user.role.name}${
          keepElevatedRole ? " (preserved)" : ""
        }`
      );
    } else {
      const user = await prisma.user.create({
        data: {
          email: member.email,
          name: member.name,
          designation: member.designation,
          roleId,
          managerUserId: null,
          isActive: true
        },
        include: { role: true }
      });
      created += 1;
      console.log(
        `  + ${user.name} <${user.email}> — ${member.designation} — role: ${user.role.name}`
      );
    }
  }

  console.log(
    `\nDone. created=${created} updated=${updated} preservedElevatedRole=${preservedRole}`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("Script failed:", e);
    prisma.$disconnect();
    process.exit(1);
  });
