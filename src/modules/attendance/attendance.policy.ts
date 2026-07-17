import { prisma } from "../../lib/prisma";

const POLICY_DOC_ID = "default";

export type AttendancePolicyPayload = {
  id: string;
  bodyMd: string;
  updatedAt: string;
  updatedBy: { id: string; name: string } | null;
};

function serializePolicy(doc: {
  id: string;
  bodyMd: string;
  updatedAt: Date;
  updatedBy: { id: string; name: string } | null;
}): AttendancePolicyPayload {
  return {
    id: doc.id,
    bodyMd: doc.bodyMd,
    updatedAt: doc.updatedAt.toISOString(),
    updatedBy: doc.updatedBy
  };
}

async function ensurePolicyDoc() {
  return prisma.attendancePolicyDoc.upsert({
    where: { id: POLICY_DOC_ID },
    create: { id: POLICY_DOC_ID, bodyMd: "" },
    update: {},
    include: {
      updatedBy: { select: { id: true, name: true } }
    }
  });
}

export async function getAttendancePolicy(): Promise<AttendancePolicyPayload> {
  const doc = await ensurePolicyDoc();
  return serializePolicy(doc);
}

export async function updateAttendancePolicy(input: {
  bodyMd: string;
  updatedById: string;
}): Promise<AttendancePolicyPayload> {
  const doc = await prisma.attendancePolicyDoc.upsert({
    where: { id: POLICY_DOC_ID },
    create: {
      id: POLICY_DOC_ID,
      bodyMd: input.bodyMd,
      updatedById: input.updatedById
    },
    update: {
      bodyMd: input.bodyMd,
      updatedById: input.updatedById
    },
    include: {
      updatedBy: { select: { id: true, name: true } }
    }
  });
  return serializePolicy(doc);
}
