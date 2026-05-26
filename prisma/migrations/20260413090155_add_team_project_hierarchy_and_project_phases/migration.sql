BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Team] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(2000),
    [createdById] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [Team_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Team_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Team_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[TeamMember] (
    [id] NVARCHAR(1000) NOT NULL,
    [teamId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [memberRole] NVARCHAR(1000) NOT NULL CONSTRAINT [TeamMember_memberRole_df] DEFAULT 'MEMBER',
    [reportsToUserId] NVARCHAR(1000),
    [joinedAt] DATETIME2 NOT NULL CONSTRAINT [TeamMember_joinedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [isActive] BIT NOT NULL CONSTRAINT [TeamMember_isActive_df] DEFAULT 1,
    CONSTRAINT [TeamMember_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TeamMember_teamId_userId_key] UNIQUE NONCLUSTERED ([teamId],[userId])
);

-- CreateTable
CREATE TABLE [dbo].[Project] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(2000),
    [objectives] NVARCHAR(max),
    [finalLink] NVARCHAR(2000),
    [createdById] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Project_status_df] DEFAULT 'ACTIVE',
    [startsAt] DATETIME2,
    [endsAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Project_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Project_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ProjectPhase] (
    [id] NVARCHAR(1000) NOT NULL,
    [projectId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [objectives] NVARCHAR(max),
    [deadline] DATETIME2,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [ProjectPhase_status_df] DEFAULT 'PLANNED',
    [orderIndex] INT NOT NULL CONSTRAINT [ProjectPhase_orderIndex_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProjectPhase_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ProjectPhase_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ProjectMember] (
    [id] NVARCHAR(1000) NOT NULL,
    [projectId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [memberRole] NVARCHAR(1000) NOT NULL CONSTRAINT [ProjectMember_memberRole_df] DEFAULT 'MEMBER',
    [reportsToUserId] NVARCHAR(1000),
    [joinedAt] DATETIME2 NOT NULL CONSTRAINT [ProjectMember_joinedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [isActive] BIT NOT NULL CONSTRAINT [ProjectMember_isActive_df] DEFAULT 1,
    CONSTRAINT [ProjectMember_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ProjectMember_projectId_userId_key] UNIQUE NONCLUSTERED ([projectId],[userId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Team_createdById_idx] ON [dbo].[Team]([createdById]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Team_name_idx] ON [dbo].[Team]([name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TeamMember_teamId_idx] ON [dbo].[TeamMember]([teamId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TeamMember_userId_idx] ON [dbo].[TeamMember]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [TeamMember_reportsToUserId_idx] ON [dbo].[TeamMember]([reportsToUserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Project_createdById_idx] ON [dbo].[Project]([createdById]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Project_status_idx] ON [dbo].[Project]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Project_name_idx] ON [dbo].[Project]([name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProjectPhase_projectId_idx] ON [dbo].[ProjectPhase]([projectId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProjectPhase_projectId_orderIndex_idx] ON [dbo].[ProjectPhase]([projectId], [orderIndex]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProjectPhase_deadline_idx] ON [dbo].[ProjectPhase]([deadline]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProjectMember_projectId_idx] ON [dbo].[ProjectMember]([projectId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProjectMember_userId_idx] ON [dbo].[ProjectMember]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ProjectMember_reportsToUserId_idx] ON [dbo].[ProjectMember]([reportsToUserId]);

-- AddForeignKey
ALTER TABLE [dbo].[Team] ADD CONSTRAINT [Team_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[TeamMember] ADD CONSTRAINT [TeamMember_teamId_fkey] FOREIGN KEY ([teamId]) REFERENCES [dbo].[Team]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TeamMember] ADD CONSTRAINT [TeamMember_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TeamMember] ADD CONSTRAINT [TeamMember_reportsToUserId_fkey] FOREIGN KEY ([reportsToUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Project] ADD CONSTRAINT [Project_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ProjectPhase] ADD CONSTRAINT [ProjectPhase_projectId_fkey] FOREIGN KEY ([projectId]) REFERENCES [dbo].[Project]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProjectMember] ADD CONSTRAINT [ProjectMember_projectId_fkey] FOREIGN KEY ([projectId]) REFERENCES [dbo].[Project]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProjectMember] ADD CONSTRAINT [ProjectMember_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ProjectMember] ADD CONSTRAINT [ProjectMember_reportsToUserId_fkey] FOREIGN KEY ([reportsToUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
