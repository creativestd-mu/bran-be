/**
 * One-off: set User.managerUserId from the Q3 reporting manager sheet.
 * Run with: npx tsx prisma/set-org-hierarchy.ts
 *
 * Matches employees by email (preferred) or exact name.
 * Creates missing employees who appear in the sheet when an email is known.
 * Leaves manager null when the manager is outside the system (e.g. Pratham Mittal).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** employeeEmail → managerEmail | managerName (resolved later) */
type Edge = {
  employeeEmail?: string;
  employeeName: string;
  managerEmail?: string;
  managerName: string | null;
  designation?: string;
  roleName?: string;
};

/**
 * Reporting lines from the goals sheet.
 * managerName null = top of Creative Studio tree in this system (Pratham Mittal not onboarded).
 */
const HIERARCHY: Edge[] = [
  // Top
  {
    employeeEmail: "divyam.goenka@mastersunion.org",
    employeeName: "Divyam Amit Goenka",
    managerName: null // Pratham Mittal — not in Bran users
  },

  // Direct reports to Divyam
  {
    employeeEmail: "arun.rengaswamy@mastersunion.org",
    employeeName: "Arun Rengaswamy",
    managerEmail: "divyam.goenka@mastersunion.org",
    managerName: "Divyam Amit Goenka"
  },
  {
    employeeEmail: "devansh.kotak@mastersunion.org",
    employeeName: "Devansh Harsh Kotak",
    managerEmail: "divyam.goenka@mastersunion.org",
    managerName: "Divyam Amit Goenka"
  },
  {
    employeeEmail: "ananya.dengri@mastersunion.org",
    employeeName: "Ananya Dengri",
    managerEmail: "divyam.goenka@mastersunion.org",
    managerName: "Divyam Amit Goenka"
  },
  {
    employeeEmail: "sudeep.purwar@mastersunion.org",
    employeeName: "Sudeep Purwar",
    managerEmail: "divyam.goenka@mastersunion.org",
    managerName: "Divyam Amit Goenka"
  },
  {
    employeeEmail: "pratham.nagpal@mastersunion.org",
    employeeName: "Pratham Nagpal",
    managerEmail: "divyam.goenka@mastersunion.org",
    managerName: "Divyam Amit Goenka"
  },
  {
    employeeEmail: "neha1@mastersunion.org",
    employeeName: "Neha",
    managerEmail: "divyam.goenka@mastersunion.org",
    managerName: "Divyam Amit Goenka"
  },
  {
    employeeEmail: "naveen.kumar@mastersunion.org",
    employeeName: "Naveen Kumar",
    managerEmail: "divyam.goenka@mastersunion.org",
    managerName: "Divyam Amit Goenka"
  },
  {
    employeeEmail: "sudipto.adhicary@mastersunion.org",
    employeeName: "Sudipto Adhicary",
    managerEmail: "divyam.goenka@mastersunion.org",
    managerName: "Divyam Amit Goenka"
  },
  {
    employeeEmail: "spandana.guduru@mastersunion.org",
    employeeName: "Spandana Guduru",
    managerEmail: "divyam.goenka@mastersunion.org",
    managerName: "Divyam Amit Goenka"
  },

  // Neha's reports
  {
    employeeEmail: "daisy.kataria@mastersunion.org",
    employeeName: "Daisy Kataria",
    managerEmail: "neha1@mastersunion.org",
    managerName: "Neha"
  },

  // Arun's Non-Fiction tree
  {
    employeeEmail: "ishika.aggarwal@mastersunion.org",
    employeeName: "Ishika Aggarwal",
    managerEmail: "arun.rengaswamy@mastersunion.org",
    managerName: "Arun Rengaswamy"
  },
  {
    employeeEmail: "shashank.rai@mastersunion.org",
    employeeName: "Shashank Rai",
    managerEmail: "arun.rengaswamy@mastersunion.org",
    managerName: "Arun Rengaswamy"
  },
  {
    employeeEmail: "raja.kumar@mastersunion.org",
    employeeName: "Raja Kumar",
    managerEmail: "arun.rengaswamy@mastersunion.org",
    managerName: "Arun Rengaswamy"
  },
  {
    employeeEmail: "sharoz.khan@mastersunion.org",
    employeeName: "Sharoz Ali Khan",
    managerEmail: "arun.rengaswamy@mastersunion.org",
    managerName: "Arun Rengaswamy"
  },
  {
    employeeEmail: "upendra.byahut@mastersunion.org",
    employeeName: "Upendra Kumar Byahut",
    managerEmail: "arun.rengaswamy@mastersunion.org",
    managerName: "Arun Rengaswamy"
  },

  // Ishika's pod
  {
    employeeEmail: "sabhya.sharma@mastersunion.org",
    employeeName: "Sabhya Sharma",
    managerEmail: "ishika.aggarwal@mastersunion.org",
    managerName: "Ishika Aggarwal"
  },
  {
    employeeEmail: "aryan.gupta@mastersunion.org",
    employeeName: "Aryan Gupta",
    managerEmail: "ishika.aggarwal@mastersunion.org",
    managerName: "Ishika Aggarwal"
  },
  {
    employeeEmail: "akshay.shrivastav@mastersunion.org",
    employeeName: "Akshay Shrivastava",
    managerEmail: "ishika.aggarwal@mastersunion.org",
    managerName: "Ishika Aggarwal"
  },
  {
    employeeEmail: "dhirendra.kumar1@mastersunion.org",
    employeeName: "Dhirendra Kumar",
    managerEmail: "ishika.aggarwal@mastersunion.org",
    managerName: "Ishika Aggarwal"
  },
  {
    employeeEmail: "sonam.kumari1@mastersunion.org",
    employeeName: "Sonam Kumari",
    managerEmail: "ishika.aggarwal@mastersunion.org",
    managerName: "Ishika Aggarwal"
  },

  // Sabhya's pod
  {
    employeeEmail: "abhishek.singh1@mastersunion.org",
    employeeName: "Abhishek Singh",
    managerEmail: "sabhya.sharma@mastersunion.org",
    managerName: "Sabhya Sharma"
  },
  // Akhil Sharma (in sheet, not previously onboarded — email unknown)
  {
    employeeName: "Akhil Sharma",
    managerEmail: "sabhya.sharma@mastersunion.org",
    managerName: "Sabhya Sharma",
    designation: "Senior Executive",
    roleName: "executive"
  },

  // Coverage under Shashank
  {
    employeeEmail: "anurag.karmshil@mastersunion.org",
    employeeName: "Anurag Karmshil",
    managerEmail: "shashank.rai@mastersunion.org",
    managerName: "Shashank Rai"
  },
  {
    employeeEmail: "shaz.khan@mastersunion.org",
    employeeName: "Mohd. Shaz Khan",
    managerEmail: "shashank.rai@mastersunion.org",
    managerName: "Shashank Rai"
  },
  {
    employeeEmail: "sandeep.raniwal@mastersunion.org",
    employeeName: "Sandeep Kumar",
    managerEmail: "shashank.rai@mastersunion.org",
    managerName: "Shashank Rai"
  },
  {
    employeeEmail: "sagnik.ganguly@mastersunion.org",
    employeeName: "Sagnik Ganguly",
    managerEmail: "shashank.rai@mastersunion.org",
    managerName: "Shashank Rai"
  },
  {
    employeeEmail: "nitin.garg@mastersunion.org",
    employeeName: "Nitin Garg",
    managerEmail: "shashank.rai@mastersunion.org",
    managerName: "Shashank Rai"
  },

  // Builders.mu under Raja
  {
    employeeEmail: "ratnam.kalra@mastersunion.org",
    employeeName: "Ratnam Kalra",
    managerEmail: "raja.kumar@mastersunion.org",
    managerName: "Raja Kumar"
  },
  {
    employeeEmail: "nishant.singh2@mastersunion.org",
    employeeName: "Nishant Singh",
    managerEmail: "raja.kumar@mastersunion.org",
    managerName: "Raja Kumar"
  },
  {
    employeeEmail: "virendra.rathod@mastersunion.org",
    employeeName: "Virendra Khimji Rathod",
    managerEmail: "raja.kumar@mastersunion.org",
    managerName: "Raja Kumar"
  },
  {
    employeeEmail: "pratik.sharma@mastersunion.org",
    employeeName: "Pratik Sharma",
    managerEmail: "raja.kumar@mastersunion.org",
    managerName: "Raja Kumar"
  },
  {
    employeeEmail: "sudhanshu.kumar@mastersunion.org",
    employeeName: "Sudhanshu Kumar",
    managerEmail: "raja.kumar@mastersunion.org",
    managerName: "Raja Kumar"
  },

  // Non-Fiction production under Upendra
  {
    employeeEmail: "ram.kumar@mastersunion.org",
    employeeName: "Ram Kumar",
    managerEmail: "upendra.byahut@mastersunion.org",
    managerName: "Upendra Kumar Byahut"
  },
  {
    employeeEmail: "sharwan.kumar@mastersunion.org",
    employeeName: "Sharwan Kumar",
    managerEmail: "upendra.byahut@mastersunion.org",
    managerName: "Upendra Kumar Byahut"
  },

  // Fiction under Devansh
  {
    employeeEmail: "gaurang.khanna@mastersunion.org",
    employeeName: "Gaurang Khanna",
    managerEmail: "devansh.kotak@mastersunion.org",
    managerName: "Devansh Harsh Kotak"
  },
  {
    employeeEmail: "swarnim.singh@mastersunion.org",
    employeeName: "Swarnim Singh Rokey",
    managerEmail: "devansh.kotak@mastersunion.org",
    managerName: "Devansh Harsh Kotak"
  },
  {
    employeeEmail: "eby.manuel@mastersunion.org",
    employeeName: "Eby Manuel",
    managerEmail: "devansh.kotak@mastersunion.org",
    managerName: "Devansh Harsh Kotak"
  },
  {
    employeeEmail: "soumadip.patra@mastersunion.org",
    employeeName: "Soumadip Patra",
    managerEmail: "devansh.kotak@mastersunion.org",
    managerName: "Devansh Harsh Kotak"
  },
  {
    employeeEmail: "abhishek.mishra1@mastersunion.org",
    employeeName: "Abhishek Mishra",
    managerEmail: "devansh.kotak@mastersunion.org",
    managerName: "Devansh Harsh Kotak"
  },
  {
    employeeEmail: "mrittika.maitra@mastersunion.org",
    employeeName: "Mrittika Maitra",
    managerEmail: "devansh.kotak@mastersunion.org",
    managerName: "Devansh Harsh Kotak"
  },
  {
    employeeEmail: "tejal.dua@mastersunion.org",
    employeeName: "Tejal Dua",
    managerEmail: "devansh.kotak@mastersunion.org",
    managerName: "Devansh Harsh Kotak"
  },

  // Soumadip's post team
  {
    employeeEmail: "joel.anto@mastersunion.org",
    employeeName: "Joel Anto",
    managerEmail: "soumadip.patra@mastersunion.org",
    managerName: "Soumadip Patra"
  },
  {
    employeeEmail: "bhanu.prakash@mastersunion.org",
    employeeName: "B Bhanu Prakash",
    managerEmail: "soumadip.patra@mastersunion.org",
    managerName: "Soumadip Patra"
  },
  {
    employeeEmail: "tapas.mandal@mastersunion.org",
    employeeName: "Tapas Mandal",
    managerEmail: "soumadip.patra@mastersunion.org",
    managerName: "Soumadip Patra"
  },
  {
    employeeEmail: "sreejith.padmakumar@mastersunion.org",
    employeeName: "Sreejith Padmakumar",
    managerEmail: "soumadip.patra@mastersunion.org",
    managerName: "Soumadip Patra"
  },
  {
    employeeEmail: "mainak.baidya@mastersunion.org",
    employeeName: "Mainak Baidya",
    managerEmail: "soumadip.patra@mastersunion.org",
    managerName: "Soumadip Patra"
  },

  // Fiction production under Abhishek Mishra
  {
    employeeEmail: "anas.khan@mastersunion.org",
    employeeName: "Anas Khan",
    managerEmail: "abhishek.mishra1@mastersunion.org",
    managerName: "Abhishek Mishra"
  },
  {
    employeeEmail: "ashok.tirkey@mastersunion.org",
    employeeName: "Ashok Tirkey",
    managerEmail: "abhishek.mishra1@mastersunion.org",
    managerName: "Abhishek Mishra"
  },
  {
    employeeEmail: "md.zakaullah@mastersunion.org",
    employeeName: "Md Zakaullah",
    managerEmail: "abhishek.mishra1@mastersunion.org",
    managerName: "Abhishek Mishra"
  },
  {
    employeeEmail: "vikash.pandit@mastersunion.org",
    employeeName: "Vikash Pandit",
    managerEmail: "abhishek.mishra1@mastersunion.org",
    managerName: "Abhishek Mishra"
  },

  // Dhirendra's reports
  {
    employeeName: "Abhishek Nair",
    managerEmail: "dhirendra.kumar1@mastersunion.org",
    managerName: "Dhirendra Kumar",
    designation: "Executive",
    roleName: "executive"
  },

  // Mrittika's report
  {
    employeeEmail: "tushar.singh1@mastersunion.org",
    employeeName: "Tushar Singh",
    managerEmail: "mrittika.maitra@mastersunion.org",
    managerName: "Mrittika Maitra"
  },

  // Brand under Ananya Dengri
  {
    employeeEmail: "pragya.rastogi@mastersunion.org",
    employeeName: "Pragya Rastogi",
    managerEmail: "ananya.dengri@mastersunion.org",
    managerName: "Ananya Dengri"
  },
  {
    employeeEmail: "ananya.singh1@mastersunion.org",
    employeeName: "Ananya Singh",
    managerEmail: "ananya.dengri@mastersunion.org",
    managerName: "Ananya Dengri"
  },
  {
    employeeEmail: "ayushi.kumari@mastersunion.org",
    employeeName: "Ayushi Kumari",
    managerEmail: "ananya.dengri@mastersunion.org",
    managerName: "Ananya Dengri"
  },
  {
    employeeEmail: "akash.pk@mastersunion.org",
    employeeName: "Akash P K",
    managerEmail: "ananya.dengri@mastersunion.org",
    managerName: "Ananya Dengri"
  },

  // Akash's report
  {
    employeeEmail: "irmeen.ansari@mastersunion.org",
    employeeName: "Irmeen Ansari",
    managerEmail: "akash.pk@mastersunion.org",
    managerName: "Akash P K"
  },

  // Socials under Sudipto
  {
    employeeEmail: "varchasvi.mahajan@mastersunion.org",
    employeeName: "Varchasvi Mahajan",
    managerEmail: "sudipto.adhicary@mastersunion.org",
    managerName: "Sudipto Adhicary"
  },
  {
    employeeEmail: "samar.ansari@mastersunion.org",
    employeeName: "Samar Ansari",
    managerEmail: "sudipto.adhicary@mastersunion.org",
    managerName: "Sudipto Adhicary"
  },
  {
    employeeEmail: "prachi.malik@mastersunion.org",
    employeeName: "Prachi Malik",
    managerEmail: "sudipto.adhicary@mastersunion.org",
    managerName: "Sudipto Adhicary"
  },
  {
    employeeEmail: "khushi.nahar@mastersunion.org",
    employeeName: "Khushi Nahar",
    managerEmail: "sudipto.adhicary@mastersunion.org",
    managerName: "Sudipto Adhicary"
  },
  {
    employeeEmail: "mani.sharma@mastersunion.org",
    employeeName: "Mani Sharma",
    managerEmail: "sudipto.adhicary@mastersunion.org",
    managerName: "Sudipto Adhicary"
  },
  {
    employeeEmail: "arijit.bose@mastersunion.org",
    employeeName: "Arijit Bose",
    managerEmail: "sudipto.adhicary@mastersunion.org",
    managerName: "Sudipto Adhicary"
  },

  // Sudeep's reports
  {
    employeeEmail: "amisha.sharma@mastersunion.org",
    employeeName: "Amisha Sharma",
    managerEmail: "sudeep.purwar@mastersunion.org",
    managerName: "Sudeep Purwar"
  },
  {
    employeeEmail: "dhananjay.jain@mastersunion.org",
    employeeName: "Dhananjay Jain",
    managerEmail: "sudeep.purwar@mastersunion.org",
    managerName: "Sudeep Purwar"
  }
];

/** Name aliases used in the sheet vs DB */
const NAME_ALIASES: Record<string, string[]> = {
  Neha: ["Neha", "Neha ."],
  "Devansh Harsh Kotak": ["Devansh Harsh Kotak", "Devansh Kotak"],
  "Swarnim Singh Rokey": ["Swarnim Singh Rokey", "Swarnim Singh"],
  "Mohd. Shaz Khan": ["Mohd. Shaz Khan", "Mohd Shaz Khan", "Shaz Khan"]
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  console.log(`Setting hierarchy for ${HIERARCHY.length} reporting lines...\n`);

  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, roleId: true, designation: true }
  });

  const byEmail = new Map(allUsers.map((u) => [u.email.toLowerCase(), u]));
  const byNormName = new Map<string, typeof allUsers>();
  for (const u of allUsers) {
    const key = normalize(u.name);
    const list = byNormName.get(key) ?? [];
    list.push(u);
    byNormName.set(key, list);
  }

  function findByName(name: string) {
    const aliases = NAME_ALIASES[name] ?? [name];
    for (const alias of aliases) {
      const hits = byNormName.get(normalize(alias));
      if (hits?.length === 1) return hits[0];
      if (hits && hits.length > 1) {
        throw new Error(`Ambiguous name "${alias}": ${hits.map((h) => h.email).join(", ")}`);
      }
    }
    // fuzzy: starts with first token
    const first = normalize(name).split(" ")[0];
    const fuzzy = allUsers.filter((u) => normalize(u.name).startsWith(first));
    if (fuzzy.length === 1) return fuzzy[0];
    return null;
  }

  const executiveRole = await prisma.role.findUnique({ where: { name: "executive" } });
  if (!executiveRole) throw new Error("executive role missing — run onboard-org-users first");

  let updated = 0;
  const warnings: string[] = [];

  for (const edge of HIERARCHY) {
    let employee =
      (edge.employeeEmail && byEmail.get(edge.employeeEmail.toLowerCase())) ||
      findByName(edge.employeeName);

    if (!employee) {
      if (!edge.employeeEmail) {
        warnings.push(
          `SKIP "${edge.employeeName}" — in sheet but no email; cannot onboard or link`
        );
        continue;
      }
      const created = await prisma.user.create({
        data: {
          email: edge.employeeEmail,
          name: edge.employeeName,
          designation: edge.designation ?? null,
          roleId: executiveRole.id,
          managerUserId: null,
          isActive: true
        },
        select: { id: true, name: true, email: true, roleId: true, designation: true }
      });
      byEmail.set(created.email.toLowerCase(), created);
      const list = byNormName.get(normalize(created.name)) ?? [];
      list.push(created);
      byNormName.set(normalize(created.name), list);
      allUsers.push(created);
      employee = created;
      console.log(`  + created ${created.name} <${created.email}>`);
    }

    let managerId: string | null = null;
    if (edge.managerName) {
      const manager =
        (edge.managerEmail && byEmail.get(edge.managerEmail.toLowerCase())) ||
        findByName(edge.managerName);
      if (!manager) {
        warnings.push(
          `WARN ${edge.employeeName}: manager "${edge.managerName}" not found — leaving unset`
        );
        continue;
      }
      managerId = manager.id;
    }

    await prisma.user.update({
      where: { id: employee.id },
      data: { managerUserId: managerId }
    });
    updated += 1;
    console.log(
      `  ✓ ${employee.name} → ${edge.managerName ?? "(none / Pratham Mittal outside system)"}`
    );
  }

  if (warnings.length) {
    console.log("\nWarnings:");
    for (const w of warnings) console.log(`  ${w}`);
  }

  // Print tree roots under Divyam
  const withManagers = await prisma.user.findMany({
    where: { isActive: true, email: { endsWith: "@mastersunion.org" } },
    select: {
      name: true,
      email: true,
      manager: { select: { name: true, email: true } }
    },
    orderBy: { name: "asc" }
  });

  const withMgr = withManagers.filter((u) => u.manager).length;
  const withoutMgr = withManagers.filter((u) => !u.manager).length;

  console.log(`\nDone. updates=${updated}`);
  console.log(`Active @mastersunion.org: ${withMgr} with manager, ${withoutMgr} without`);
  console.log("\nNo-manager users:");
  for (const u of withManagers.filter((x) => !x.manager)) {
    console.log(`  - ${u.name} <${u.email}>`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("Script failed:", e);
    prisma.$disconnect();
    process.exit(1);
  });
