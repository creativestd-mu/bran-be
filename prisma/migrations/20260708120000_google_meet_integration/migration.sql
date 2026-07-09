-- CreateTable
CREATE TABLE "CalendarConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "recallCalendarId" VARCHAR(200) NOT NULL,
    "oauthEmail" VARCHAR(320),
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "organizerUserId" TEXT NOT NULL,
    "recallBotId" VARCHAR(200),
    "calendarEventId" VARCHAR(200),
    "meetingUrl" VARCHAR(1000) NOT NULL,
    "title" VARCHAR(500),
    "startTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "voiceRecordingId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConnection_userId_key" ON "CalendarConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConnection_recallCalendarId_key" ON "CalendarConnection"("recallCalendarId");

-- CreateIndex
CREATE INDEX "CalendarConnection_status_idx" ON "CalendarConnection"("status");

-- CreateIndex
CREATE INDEX "CalendarConnection_recallCalendarId_idx" ON "CalendarConnection"("recallCalendarId");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_recallBotId_key" ON "Meeting"("recallBotId");

-- CreateIndex
CREATE INDEX "Meeting_organizerUserId_idx" ON "Meeting"("organizerUserId");

-- CreateIndex
CREATE INDEX "Meeting_organizerUserId_createdAt_idx" ON "Meeting"("organizerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- CreateIndex
CREATE INDEX "Meeting_calendarEventId_idx" ON "Meeting"("calendarEventId");

-- CreateIndex
CREATE INDEX "Meeting_voiceRecordingId_idx" ON "Meeting"("voiceRecordingId");

-- AddForeignKey
ALTER TABLE "CalendarConnection" ADD CONSTRAINT "CalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_organizerUserId_fkey" FOREIGN KEY ("organizerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_voiceRecordingId_fkey" FOREIGN KEY ("voiceRecordingId") REFERENCES "VoiceRecording"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
