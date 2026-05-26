BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Role] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Role_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Role_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Role_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[Permission] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(500),
    CONSTRAINT [Permission_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Permission_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[RolePermission] (
    [roleId] NVARCHAR(1000) NOT NULL,
    [permissionId] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [RolePermission_pkey] PRIMARY KEY CLUSTERED ([roleId],[permissionId])
);

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(1000) NOT NULL,
    [googleId] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [avatarUrl] NVARCHAR(1000),
    [description] NVARCHAR(2000),
    [phone] NVARCHAR(1000),
    [designation] NVARCHAR(1000),
    [roleId] NVARCHAR(1000) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [User_isActive_df] DEFAULT 1,
    [lastLoginAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_googleId_key] UNIQUE NONCLUSTERED ([googleId]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Task] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(500) NOT NULL,
    [description] NVARCHAR(4000),
    [type] NVARCHAR(1000) NOT NULL CONSTRAINT [Task_type_df] DEFAULT 'GENERAL',
    [platform] NVARCHAR(1000),
    [contentUrl] NVARCHAR(2000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Task_status_df] DEFAULT 'PENDING',
    [metadata] NVARCHAR(max),
    [dueDate] DATETIME2,
    [completedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Task_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Task_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[SocialAccount] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [platform] NVARCHAR(1000) NOT NULL,
    [platformAccountId] NVARCHAR(1000) NOT NULL,
    [handle] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SocialAccount_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [SocialAccount_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SocialAccount_userId_platform_platformAccountId_key] UNIQUE NONCLUSTERED ([userId],[platform],[platformAccountId])
);

-- CreateTable
CREATE TABLE [dbo].[InstagramPerformance] (
    [id] NVARCHAR(1000) NOT NULL,
    [source] NVARCHAR(1000) NOT NULL CONSTRAINT [InstagramPerformance_source_df] DEFAULT 'instagram',
    [sourceItemId] NVARCHAR(1000) NOT NULL,
    [language] NVARCHAR(1000) NOT NULL,
    [mentionCount] INT NOT NULL CONSTRAINT [InstagramPerformance_mentionCount_df] DEFAULT 0,
    [estimatedViews] INT NOT NULL CONSTRAINT [InstagramPerformance_estimatedViews_df] DEFAULT 0,
    [estimatedReach] INT NOT NULL CONSTRAINT [InstagramPerformance_estimatedReach_df] DEFAULT 0,
    [engagement] INT NOT NULL CONSTRAINT [InstagramPerformance_engagement_df] DEFAULT 0,
    [engagementCount] INT NOT NULL CONSTRAINT [InstagramPerformance_engagementCount_df] DEFAULT 0,
    [engagementRate] FLOAT(53) NOT NULL CONSTRAINT [InstagramPerformance_engagementRate_df] DEFAULT 0,
    [sentiment] NVARCHAR(1000) NOT NULL CONSTRAINT [InstagramPerformance_sentiment_df] DEFAULT 'unknown',
    [mentionedAt] DATETIME2 NOT NULL,
    [rawPayload] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InstagramPerformance_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [InstagramPerformance_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [InstagramPerformance_sourceItemId_key] UNIQUE NONCLUSTERED ([sourceItemId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_roleId_idx] ON [dbo].[User]([roleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_email_idx] ON [dbo].[User]([email]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Task_userId_idx] ON [dbo].[Task]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Task_status_idx] ON [dbo].[Task]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Task_userId_status_idx] ON [dbo].[Task]([userId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Task_userId_createdAt_idx] ON [dbo].[Task]([userId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Task_type_platform_idx] ON [dbo].[Task]([type], [platform]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SocialAccount_userId_idx] ON [dbo].[SocialAccount]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InstagramPerformance_mentionedAt_idx] ON [dbo].[InstagramPerformance]([mentionedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InstagramPerformance_source_mentionedAt_idx] ON [dbo].[InstagramPerformance]([source], [mentionedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InstagramPerformance_language_mentionedAt_idx] ON [dbo].[InstagramPerformance]([language], [mentionedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InstagramPerformance_source_language_mentionedAt_idx] ON [dbo].[InstagramPerformance]([source], [language], [mentionedAt]);

-- AddForeignKey
ALTER TABLE [dbo].[RolePermission] ADD CONSTRAINT [RolePermission_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RolePermission] ADD CONSTRAINT [RolePermission_permissionId_fkey] FOREIGN KEY ([permissionId]) REFERENCES [dbo].[Permission]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Task] ADD CONSTRAINT [Task_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[SocialAccount] ADD CONSTRAINT [SocialAccount_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
