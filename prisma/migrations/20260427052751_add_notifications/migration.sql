BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Notification] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [kind] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(500) NOT NULL,
    [body] NVARCHAR(max),
    [data] NVARCHAR(max),
    [dedupeKey] NVARCHAR(500),
    [readAt] DATETIME2,
    [emailSentAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Notification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Notification_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Notification_userId_dedupeKey_key] UNIQUE NONCLUSTERED ([userId],[dedupeKey])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Notification_userId_readAt_idx] ON [dbo].[Notification]([userId], [readAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Notification_userId_createdAt_idx] ON [dbo].[Notification]([userId], [createdAt]);

-- AddForeignKey
ALTER TABLE [dbo].[Notification] ADD CONSTRAINT [Notification_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
