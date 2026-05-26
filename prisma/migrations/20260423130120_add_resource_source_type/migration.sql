BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[ContentNodeResource] DROP CONSTRAINT [ContentNodeResource_currency_df];
ALTER TABLE [dbo].[ContentNodeResource] ALTER COLUMN [cost] DECIMAL(18,2) NULL;
ALTER TABLE [dbo].[ContentNodeResource] ALTER COLUMN [currency] NVARCHAR(1000) NULL;
ALTER TABLE [dbo].[ContentNodeResource] ADD [sourceType] NVARCHAR(1000) NOT NULL CONSTRAINT [ContentNodeResource_sourceType_df] DEFAULT 'IN_HOUSE';

-- CreateIndex
CREATE NONCLUSTERED INDEX [ContentNodeResource_nodeId_sourceType_idx] ON [dbo].[ContentNodeResource]([nodeId], [sourceType]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
