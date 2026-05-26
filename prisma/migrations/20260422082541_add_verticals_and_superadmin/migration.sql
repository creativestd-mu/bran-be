BEGIN TRY

BEGIN TRAN;

-- ─── 1. Permission: manage_verticals ───────────────────────────
DECLARE @manageVerticalsPermId NVARCHAR(1000);
SELECT @manageVerticalsPermId = [id] FROM [dbo].[Permission] WHERE [name] = 'manage_verticals';
IF @manageVerticalsPermId IS NULL
BEGIN
    SET @manageVerticalsPermId = LOWER(CONVERT(NVARCHAR(36), NEWID()));
    INSERT INTO [dbo].[Permission] ([id], [name], [description])
    VALUES (@manageVerticalsPermId, 'manage_verticals', 'Manage verticals and reassign vertical owners');
END;

-- ─── 2. Role: superadmin (users will be assigned later) ────────
DECLARE @superAdminRoleId NVARCHAR(1000);
SELECT @superAdminRoleId = [id] FROM [dbo].[Role] WHERE [name] = 'superadmin';
IF @superAdminRoleId IS NULL
BEGIN
    SET @superAdminRoleId = LOWER(CONVERT(NVARCHAR(36), NEWID()));
    INSERT INTO [dbo].[Role] ([id], [name], [description], [createdAt], [updatedAt])
    VALUES (
        @superAdminRoleId,
        'superadmin',
        'Super Admin with full access including vertical owner reassignment',
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );
END;

-- Assign every existing permission (including manage_verticals) to superadmin
INSERT INTO [dbo].[RolePermission] ([roleId], [permissionId])
SELECT @superAdminRoleId, p.[id]
FROM [dbo].[Permission] p
WHERE NOT EXISTS (
    SELECT 1
    FROM [dbo].[RolePermission] rp
    WHERE rp.[roleId] = @superAdminRoleId
      AND rp.[permissionId] = p.[id]
);

-- ─── 3. Vertical table ─────────────────────────────────────────
CREATE TABLE [dbo].[Vertical] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [slug] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(2000),
    [ownerUserId] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Vertical_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Vertical_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Vertical_name_key] UNIQUE NONCLUSTERED ([name]),
    CONSTRAINT [Vertical_slug_key] UNIQUE NONCLUSTERED ([slug])
);

CREATE NONCLUSTERED INDEX [Vertical_ownerUserId_idx] ON [dbo].[Vertical]([ownerUserId]);
CREATE NONCLUSTERED INDEX [Vertical_slug_idx] ON [dbo].[Vertical]([slug]);

ALTER TABLE [dbo].[Vertical]
    ADD CONSTRAINT [Vertical_ownerUserId_fkey]
    FOREIGN KEY ([ownerUserId]) REFERENCES [dbo].[User]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;

-- ─── 4. Seed Fiction & Non Fiction (no owners yet) ─────────────
DECLARE @fictionId NVARCHAR(1000) = LOWER(CONVERT(NVARCHAR(36), NEWID()));
DECLARE @nonFictionId NVARCHAR(1000) = LOWER(CONVERT(NVARCHAR(36), NEWID()));

INSERT INTO [dbo].[Vertical] ([id], [name], [slug], [description], [createdAt], [updatedAt])
VALUES
    (@fictionId, 'Fiction', 'fiction',
     'Fiction vertical: stories, novels, and creative narratives.',
     SYSUTCDATETIME(), SYSUTCDATETIME()),
    (@nonFictionId, 'Non Fiction', 'non-fiction',
     'Non Fiction vertical: factual content, education, journalism.',
     SYSUTCDATETIME(), SYSUTCDATETIME());

-- ─── 5. Add verticalId to Team ─────────────────────────────────
ALTER TABLE [dbo].[Team] ADD [verticalId] NVARCHAR(1000) NULL;
EXEC('UPDATE [dbo].[Team] SET [verticalId] = (SELECT TOP 1 [id] FROM [dbo].[Vertical] WHERE [slug] = ''fiction'') WHERE [verticalId] IS NULL');
ALTER TABLE [dbo].[Team] ALTER COLUMN [verticalId] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Team]
    ADD CONSTRAINT [Team_verticalId_fkey]
    FOREIGN KEY ([verticalId]) REFERENCES [dbo].[Vertical]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE NONCLUSTERED INDEX [Team_verticalId_idx] ON [dbo].[Team]([verticalId]);

-- ─── 6. Add verticalId to Project ──────────────────────────────
ALTER TABLE [dbo].[Project] ADD [verticalId] NVARCHAR(1000) NULL;
EXEC('UPDATE [dbo].[Project] SET [verticalId] = (SELECT TOP 1 [id] FROM [dbo].[Vertical] WHERE [slug] = ''fiction'') WHERE [verticalId] IS NULL');
ALTER TABLE [dbo].[Project] ALTER COLUMN [verticalId] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Project]
    ADD CONSTRAINT [Project_verticalId_fkey]
    FOREIGN KEY ([verticalId]) REFERENCES [dbo].[Vertical]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE NONCLUSTERED INDEX [Project_verticalId_idx] ON [dbo].[Project]([verticalId]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
