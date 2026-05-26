BEGIN TRY

BEGIN TRAN;

-- ─── 1. Permission: approve_rental_resources ─────────────────────
DECLARE @approveRentalPermId NVARCHAR(1000);
SELECT @approveRentalPermId = [id]
FROM [dbo].[Permission]
WHERE [name] = 'approve_rental_resources';

IF @approveRentalPermId IS NULL
BEGIN
    SET @approveRentalPermId = LOWER(CONVERT(NVARCHAR(36), NEWID()));
    INSERT INTO [dbo].[Permission] ([id], [name], [description])
    VALUES (
        @approveRentalPermId,
        'approve_rental_resources',
        'Approve / reject rental resource requests on content nodes (vertical heads + admins)'
    );
END;

-- Grant to superadmin and admin so admins can override; vertical owners are
-- additionally allowed by service-layer logic regardless of this permission.
INSERT INTO [dbo].[RolePermission] ([roleId], [permissionId])
SELECT r.[id], @approveRentalPermId
FROM [dbo].[Role] r
WHERE r.[name] IN ('superadmin', 'admin')
  AND NOT EXISTS (
      SELECT 1
      FROM [dbo].[RolePermission] rp
      WHERE rp.[roleId] = r.[id]
        AND rp.[permissionId] = @approveRentalPermId
  );

-- ─── 2. Content: add teamId & projectId ──────────────────────────
-- NOTE: SQL Server compiles the whole batch before running it, so any
-- statement that references the freshly-added columns must be wrapped in
-- EXEC('...') to defer name resolution. This is the same pattern used in
-- the earlier `add_verticals_and_superadmin` migration.
ALTER TABLE [dbo].[Content] ADD [teamId] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[Content] ADD [projectId] NVARCHAR(1000) NULL;

-- Best-effort backfill: pick the first project + a team in the same vertical.
EXEC('
    DECLARE @defaultProjectId NVARCHAR(1000);
    DECLARE @defaultTeamId NVARCHAR(1000);

    SELECT TOP 1
        @defaultProjectId = p.[id],
        @defaultTeamId = t.[id]
    FROM [dbo].[Project] p
    INNER JOIN [dbo].[Team] t ON t.[verticalId] = p.[verticalId]
    ORDER BY p.[createdAt] ASC;

    IF @defaultProjectId IS NOT NULL AND @defaultTeamId IS NOT NULL
    BEGIN
        UPDATE [dbo].[Content]
        SET [teamId] = @defaultTeamId,
            [projectId] = @defaultProjectId
        WHERE [teamId] IS NULL OR [projectId] IS NULL;
    END;
');

-- Hard cleanup: purge any orphaned Content rows that still can't be linked
-- (this only fires in dev DBs without any team/project to fall back to).
-- ContentNode and its children cascade-delete via existing FKs.
EXEC('DELETE FROM [dbo].[Content] WHERE [teamId] IS NULL OR [projectId] IS NULL');

ALTER TABLE [dbo].[Content] ALTER COLUMN [teamId] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[Content] ALTER COLUMN [projectId] NVARCHAR(1000) NOT NULL;

ALTER TABLE [dbo].[Content]
    ADD CONSTRAINT [Content_teamId_fkey]
    FOREIGN KEY ([teamId]) REFERENCES [dbo].[Team]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[Content]
    ADD CONSTRAINT [Content_projectId_fkey]
    FOREIGN KEY ([projectId]) REFERENCES [dbo].[Project]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE NONCLUSTERED INDEX [Content_teamId_idx] ON [dbo].[Content]([teamId]);
CREATE NONCLUSTERED INDEX [Content_projectId_idx] ON [dbo].[Content]([projectId]);

-- ─── 3. ContentNodeResource: approval workflow ───────────────────
ALTER TABLE [dbo].[ContentNodeResource]
    ADD [approvalState] NVARCHAR(1000) NOT NULL
        CONSTRAINT [ContentNodeResource_approvalState_df] DEFAULT 'PENDING';

ALTER TABLE [dbo].[ContentNodeResource] ADD [reviewNote] NVARCHAR(2000) NULL;
ALTER TABLE [dbo].[ContentNodeResource] ADD [requestedByUserId] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[ContentNodeResource] ADD [reviewedByUserId] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[ContentNodeResource] ADD [reviewedAt] DATETIME2 NULL;

-- IN_HOUSE resources do not require approval, so any pre-existing rows are
-- treated as already approved. Only RENTAL rows enter the PENDING workflow.
-- Wrapped in EXEC for the same deferred-resolution reason as above.
EXEC('UPDATE [dbo].[ContentNodeResource] SET [approvalState] = ''APPROVED'' WHERE [sourceType] = ''IN_HOUSE''');

ALTER TABLE [dbo].[ContentNodeResource]
    ADD CONSTRAINT [ContentNodeResource_requestedByUserId_fkey]
    FOREIGN KEY ([requestedByUserId]) REFERENCES [dbo].[User]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[ContentNodeResource]
    ADD CONSTRAINT [ContentNodeResource_reviewedByUserId_fkey]
    FOREIGN KEY ([reviewedByUserId]) REFERENCES [dbo].[User]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE NONCLUSTERED INDEX [ContentNodeResource_nodeId_approvalState_idx]
    ON [dbo].[ContentNodeResource]([nodeId], [approvalState]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
