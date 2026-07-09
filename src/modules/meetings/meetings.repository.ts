import { prisma } from "../../lib/prisma";

export async function findCalendarConnectionByUserId(userId: string) {
  return prisma.calendarConnection.findUnique({ where: { userId } });
}

export async function findCalendarConnectionByRecallId(recallCalendarId: string) {
  return prisma.calendarConnection.findUnique({ where: { recallCalendarId } });
}

export async function upsertCalendarConnection(data: {
  userId: string;
  recallCalendarId: string;
  oauthEmail?: string | null;
  status?: string;
}) {
  return prisma.calendarConnection.upsert({
    where: { userId: data.userId },
    create: {
      userId: data.userId,
      recallCalendarId: data.recallCalendarId,
      oauthEmail: data.oauthEmail ?? null,
      status: data.status ?? "CONNECTED",
      connectedAt: new Date(),
      disconnectedAt: null
    },
    update: {
      recallCalendarId: data.recallCalendarId,
      oauthEmail: data.oauthEmail ?? null,
      status: data.status ?? "CONNECTED",
      connectedAt: new Date(),
      disconnectedAt: null
    }
  });
}

export async function updateCalendarConnection(
  userId: string,
  data: {
    status?: string;
    disconnectedAt?: Date | null;
    oauthEmail?: string | null;
  }
) {
  return prisma.calendarConnection.update({
    where: { userId },
    data
  });
}

export async function deleteCalendarConnection(userId: string) {
  return prisma.calendarConnection.delete({ where: { userId } });
}

export async function findMeetingById(id: string) {
  return prisma.meeting.findUnique({
    where: { id },
    include: {
      voiceRecording: {
        select: {
          id: true,
          transcript: true,
          status: true
        }
      }
    }
  });
}

export async function findMeetingByRecallBotId(recallBotId: string) {
  return prisma.meeting.findUnique({ where: { recallBotId } });
}

export async function findMeetingByCalendarEventId(calendarEventId: string) {
  return prisma.meeting.findFirst({ where: { calendarEventId } });
}

export async function createMeeting(data: {
  organizerUserId: string;
  recallBotId?: string | null;
  calendarEventId?: string | null;
  meetingUrl: string;
  title?: string | null;
  startTime?: Date | null;
  status?: string;
}) {
  return prisma.meeting.create({
    data: {
      organizerUserId: data.organizerUserId,
      recallBotId: data.recallBotId ?? null,
      calendarEventId: data.calendarEventId ?? null,
      meetingUrl: data.meetingUrl,
      title: data.title ?? null,
      startTime: data.startTime ?? null,
      status: data.status ?? "SCHEDULED"
    }
  });
}

export async function updateMeeting(
  id: string,
  data: {
    recallBotId?: string | null;
    status?: string;
    voiceRecordingId?: string | null;
    errorMessage?: string | null;
    title?: string | null;
    startTime?: Date | null;
    meetingUrl?: string;
  }
) {
  return prisma.meeting.update({ where: { id }, data });
}

export async function listMeetingsForUser(
  organizerUserId: string,
  options?: { status?: string; limit?: number }
) {
  return prisma.meeting.findMany({
    where: {
      organizerUserId,
      ...(options?.status ? { status: options.status } : {})
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 50,
    include: {
      voiceRecording: {
        select: {
          id: true,
          transcript: true,
          status: true
        }
      }
    }
  });
}
