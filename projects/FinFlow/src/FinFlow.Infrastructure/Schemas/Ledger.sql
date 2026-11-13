IF OBJECT_ID('dbo.SchemaVersions') IS NULL CREATE TABLE dbo.SchemaVersions(Version int PRIMARY KEY, AppliedAt datetimeoffset NOT NULL);
IF NOT EXISTS(SELECT 1 FROM dbo.SchemaVersions WHERE Version=1)
BEGIN
 CREATE TABLE dbo.Accounts(Id uniqueidentifier NOT NULL PRIMARY KEY,Owner nvarchar(128) COLLATE Latin1_General_100_BIN2 NOT NULL,Name nvarchar(100) NOT NULL,
  BalanceMinor bigint NOT NULL CHECK(BalanceMinor>=0),Currency char(3) NOT NULL CHECK(Currency='BRL'),Version rowversion NOT NULL);
 CREATE INDEX IX_Accounts_Owner ON dbo.Accounts(Owner) INCLUDE(Name,Currency,BalanceMinor);
 CREATE TABLE dbo.Entries(Id bigint IDENTITY PRIMARY KEY,TransferId uniqueidentifier NOT NULL,AccountId uniqueidentifier NOT NULL REFERENCES dbo.Accounts(Id),
  AmountMinor bigint NOT NULL CHECK(AmountMinor<>0),CreatedAt datetimeoffset NOT NULL,
  CONSTRAINT UQ_Entries_Transfer_Account UNIQUE(TransferId,AccountId));
 CREATE INDEX IX_Entries_Account_CreatedAt ON dbo.Entries(AccountId,CreatedAt DESC);
 CREATE TABLE dbo.ProcessedTransfers(TransferId uniqueidentifier NOT NULL PRIMARY KEY,MessageId uniqueidentifier NOT NULL UNIQUE,ProcessedAt datetimeoffset NOT NULL);
 CREATE TABLE dbo.Outbox(MessageId uniqueidentifier NOT NULL PRIMARY KEY,RoutingKey varchar(64) NOT NULL,Payload nvarchar(max) NOT NULL,
  CreatedAt datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),PublishedAt datetimeoffset NULL);
 CREATE INDEX IX_Outbox_Pending ON dbo.Outbox(CreatedAt) INCLUDE(RoutingKey) WHERE PublishedAt IS NULL;
 INSERT dbo.SchemaVersions VALUES(1,SYSDATETIMEOFFSET());
END;
