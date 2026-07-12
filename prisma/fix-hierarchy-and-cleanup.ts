/**
 * One-off: fix remaining hierarchy + remove users.
 * Run: npx tsx prisma/fix-hierarchy-and-cleanup.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MANAGER_UPDATES: { employeeEmail: string; managerEmail: string }[] = [
  {
    employeeEmail: "abhishek.ghosh1@mastersunion.org",
    managerEmail: "sudeep.purwar@mastersunion.org"
  },
  {
    employeeEmail: "aryan.popli1@mastersunion.org",
    managerEmail: "ananya.dengri@mastersunion.org"
  },
  {
    employeeEmail: "aryan.sagar@mastersunion.org",
    managerEmail: "raja.kumar@mastersunion.org"
  }
];

const DELETE_EMAILS = [
  "ayushi.kothari@mastersunion.org",
  "harpreet.singh@mastersunion.org",
  "prince.koshiya@mastersunion.org",
  "trisha.das@mastersunion.org"
];

async function deleteUserHard(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`  - skip delete ${email} (not found)`);
    return;
  }

  // Clear anyone reporting to this user
  const reports = await prisma.user.updateMany({
    where: { managerUserId: user.id },
    data: { managerUserId: null }
  });
  if (reports.count > 0) {
    console.log(`    cleared ${reports.count} direct report(s)`);
  }

  // Team / project reporting links
  await prisma.teamMember.updateMany({
    where: { reportsToUserId: user.id },
    data: { reportsToUserId: null }
  });
  await prisma.projectMember.updateMany({
    where: { reportsToUserId: user.id },
    data: { reportsToUserId: null }
  });

  // Memberships owned by user
  await prisma.teamMember.deleteMany({ where: { userId: user.id } });
  await prisma.projectMember.deleteMany({ where: { userId: user.id } });
  await prisma.socialAccount.deleteMany({ where: { userId: user.id } });
  await prisma.notification.deleteMany({ where: { userId: user.id } });
  await prisma.userKpi.deleteMany({ where: { userId: user.id } });
  await prisma.navSearchLog.deleteMany({ where: { userId: user.id } });
  await prisma.userPageVisit.deleteMany({ where: { userId: user.id } });
  await prisma.nameAssignmentPreference.deleteMany({
    where: { OR: [{ ownerUserId: user.id }, { userId: user.id }] }
  });
  await prisma.visionUser.deleteMany({ where: { userId: user.id } });

  // Null out optional FKs that block delete
  await prisma.attendancePersonStats.updateMany({
    where: { userId: user.id },
    data: { userId: null }
  });
  await prisma.attendancePersonStats.updateMany({
    where: { actionTakenById: user.id },
    data: { actionTakenById: null }
  });

  // Orphan-safe deletes for owned rows that may block
  await prisma.task.deleteMany({ where: { userId: user.id } });
  await prisma.adhocWork.deleteMany({ where: { userId: user.id } });
  await prisma.aiQuery.deleteMany({ where: { userId: user.id } });
  await prisma.idea.deleteMany({ where: { authorId: user.id } });
  await prisma.voiceRecording.deleteMany({ where: { userId: user.id } });
  await prisma.calendarConnection.deleteMany({ where: { userId: user.id } });
  await prisma.meeting.deleteMany({ where: { organizerUserId: user.id } });
  await prisma.workUnit.deleteMany({ where: { userId: user.id } });
  await prisma.thumbnailGeneration.deleteMany({ where: { userId: user.id } }).catch(() => undefined);

  try {
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`  ✓ deleted ${user.name} <${email}>`);
  } catch (err) {
    // Soft-delete fallback if hard FKs remain
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false, managerUserId: null, email: `deleted+${user.id}@removed.local` }
    });
    console.log(
      `  ~ soft-deleted ${user.name} <${email}> (hard delete blocked: ${(err as Error).message.split("\n")[0]})`
    );
  }
}

async function main() {
  console.log("Updating managers...");
  for (const row of MANAGER_UPDATES) {
    const employee = await prisma.user.findUnique({ where: { email: row.employeeEmail } });
    const manager = await prisma.user.findUnique({ where: { email: row.managerEmail } });
    if (!employee) {
      console.log(`  ✗ employee not found: ${row.employeeEmail}`);
      continue;
    }
    if (!manager) {
      console.log(`  ✗ manager not found: ${row.managerEmail}`);
      continue;
    }
    await prisma.user.update({
      where: { id: employee.id },
      data: { managerUserId: manager.id }
    });
    console.log(`  ✓ ${employee.name} → ${manager.name}`);
  }

  console.log("\nDeleting users...");
  for (const email of DELETE_EMAILS) {
    await deleteUserHard(email);
  }

  console.log("\nDone.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
