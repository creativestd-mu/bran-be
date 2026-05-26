BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Content] (
    [id] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(500) NOT NULL,
    [description] NVARCHAR(2000),
    [type] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Content_status_df] DEFAULT 'DRAFT',
    [createdById] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Content_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Content_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ContentNode] (
    [id] NVARCHAR(1000) NOT NULL,
    [contentId] NVARCHAR(1000) NOT NULL,
    [kind] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(500) NOT NULL,
    [orderIndex] INT NOT NULL CONSTRAINT [ContentNode_orderIndex_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [ContentNode_status_df] DEFAULT 'PENDING',
    [notes] NVARCHAR(max),
    [startsAt] DATETIME2,
    [dueDate] DATETIME2,
    [completedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ContentNode_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ContentNode_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ContentNode_contentId_orderIndex_key] UNIQUE NONCLUSTERED ([contentId],[orderIndex])
);

-- CreateTable
CREATE TABLE [dbo].[ContentNodeTeamMember] (
    [id] NVARCHAR(1000) NOT NULL,
    [nodeId] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ContentNodeTeamMember_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ContentNodeTeamMember_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ContentNodeTeamMember_nodeId_userId_role_key] UNIQUE NONCLUSTERED ([nodeId],[userId],[role])
);

-- CreateTable
CREATE TABLE [dbo].[ContentNodeOutput] (
    [id] NVARCHAR(1000) NOT NULL,
    [nodeId] NVARCHAR(1000) NOT NULL,
    [label] NVARCHAR(500) NOT NULL,
    [url] NVARCHAR(2000) NOT NULL,
    [notes] NVARCHAR(max),
    [version] INT NOT NULL CONSTRAINT [ContentNodeOutput_version_df] DEFAULT 1,
    [submittedByUserId] NVARCHAR(1000),
    [approvalState] NVARCHAR(1000) NOT NULL CONSTRAINT [ContentNodeOutput_approvalState_df] DEFAULT 'PENDING',
    [reviewNote] NVARCHAR(2000),
    [reviewedByUserId] NVARCHAR(1000),
    [reviewedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ContentNodeOutput_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ContentNodeOutput_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ContentNodeResource] (
    [id] NVARCHAR(1000) NOT NULL,
    [nodeId] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(500) NOT NULL,
    [cost] DECIMAL(18,2) NOT NULL,
    [quantity] INT NOT NULL CONSTRAINT [ContentNodeResource_quantity_df] DEFAULT 1,
    [currency] NVARCHAR(1000) NOT NULL CONSTRAINT [ContentNodeResource_currency_df] DEFAULT 'INR',
    [notes] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ContentNodeResource_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ContentNodeResource_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Content_createdById_idx] ON [dbo].[Content]([createdById]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Content_type_idx] ON [dbo].[Content]([type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Content_status_idx] ON [dbo].[Content]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ContentNode_contentId_orderIndex_idx] ON [dbo].[ContentNode]([contentId], [orderIndex]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ContentNodeTeamMember_nodeId_idx] ON [dbo].[ContentNodeTeamMember]([nodeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ContentNodeTeamMember_userId_idx] ON [dbo].[ContentNodeTeamMember]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ContentNodeOutput_nodeId_idx] ON [dbo].[ContentNodeOutput]([nodeId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ContentNodeOutput_nodeId_approvalState_idx] ON [dbo].[ContentNodeOutput]([nodeId], [approvalState]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ContentNodeResource_nodeId_idx] ON [dbo].[ContentNodeResource]([nodeId]);

-- AddForeignKey
ALTER TABLE [dbo].[Content] ADD CONSTRAINT [Content_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ContentNode] ADD CONSTRAINT [ContentNode_contentId_fkey] FOREIGN KEY ([contentId]) REFERENCES [dbo].[Content]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ContentNodeTeamMember] ADD CONSTRAINT [ContentNodeTeamMember_nodeId_fkey] FOREIGN KEY ([nodeId]) REFERENCES [dbo].[ContentNode]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ContentNodeTeamMember] ADD CONSTRAINT [ContentNodeTeamMember_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ContentNodeOutput] ADD CONSTRAINT [ContentNodeOutput_nodeId_fkey] FOREIGN KEY ([nodeId]) REFERENCES [dbo].[ContentNode]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ContentNodeOutput] ADD CONSTRAINT [ContentNodeOutput_submittedByUserId_fkey] FOREIGN KEY ([submittedByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ContentNodeOutput] ADD CONSTRAINT [ContentNodeOutput_reviewedByUserId_fkey] FOREIGN KEY ([reviewedByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ContentNodeResource] ADD CONSTRAINT [ContentNodeResource_nodeId_fkey] FOREIGN KEY ([nodeId]) REFERENCES [dbo].[ContentNode]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
