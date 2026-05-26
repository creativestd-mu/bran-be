BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Idea] (
    [id] NVARCHAR(1000) NOT NULL,
    [authorId] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(500) NOT NULL,
    [description] NVARCHAR(max) NOT NULL,
    [tags] NVARCHAR(2000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Idea_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Idea_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[IdeaMatch] (
    [id] NVARCHAR(1000) NOT NULL,
    [ideaId] NVARCHAR(1000) NOT NULL,
    [candidateIdeaId] NVARCHAR(1000) NOT NULL,
    [matchedUserId] NVARCHAR(1000) NOT NULL,
    [score] FLOAT(53) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [IdeaMatch_status_df] DEFAULT 'SUGGESTED',
    [notifiedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [IdeaMatch_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [IdeaMatch_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [IdeaMatch_ideaId_candidateIdeaId_matchedUserId_key] UNIQUE NONCLUSTERED ([ideaId],[candidateIdeaId],[matchedUserId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Idea_authorId_idx] ON [dbo].[Idea]([authorId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Idea_createdAt_idx] ON [dbo].[Idea]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Idea_authorId_createdAt_idx] ON [dbo].[Idea]([authorId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IdeaMatch_ideaId_idx] ON [dbo].[IdeaMatch]([ideaId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IdeaMatch_matchedUserId_createdAt_idx] ON [dbo].[IdeaMatch]([matchedUserId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IdeaMatch_score_idx] ON [dbo].[IdeaMatch]([score]);

-- AddForeignKey
ALTER TABLE [dbo].[Idea] ADD CONSTRAINT [Idea_authorId_fkey] FOREIGN KEY ([authorId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[IdeaMatch] ADD CONSTRAINT [IdeaMatch_ideaId_fkey] FOREIGN KEY ([ideaId]) REFERENCES [dbo].[Idea]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[IdeaMatch] ADD CONSTRAINT [IdeaMatch_candidateIdeaId_fkey] FOREIGN KEY ([candidateIdeaId]) REFERENCES [dbo].[Idea]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[IdeaMatch] ADD CONSTRAINT [IdeaMatch_matchedUserId_fkey] FOREIGN KEY ([matchedUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
