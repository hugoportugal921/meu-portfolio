IF OBJECT_ID('dbo.SchemaVersions') IS NULL CREATE TABLE dbo.SchemaVersions(Version int PRIMARY KEY, AppliedAt datetimeoffset NOT NULL);
IF NOT EXISTS(SELECT 1 FROM dbo.SchemaVersions WHERE Version=1)
BEGIN
 CREATE TABLE dbo.Transfers(
  Id uniqueidentifier NOT NULL PRIMARY KEY,
  Subject nvarchar(128) COLLATE Latin1_General_100_BIN2 NOT NULL,
  IdempotencyKey varchar(36) NOT NULL,
  Fingerprint char(64) NOT NULL,
  SourceId uniqueidentifier NOT NULL, TargetId uniqueidentifier NOT NULL,
  AmountMinor bigint NOT NULL CHECK(AmountMinor>0 AND AmountMinor<=100000000000),
  Currency char(3) NOT NULL CHECK(Currency='BRL'),
  Status varchar(16) NOT NULL CHECK(Status IN ('Queued','Completed','Rejected')),
  Reason varchar(64) NULL, CreatedAt datetimeoffset NOT NULL, SettledAt datetimeoffset NULL,
  CONSTRAINT UQ_Transfer_Idempotency UNIQUE(Subject,IdempotencyKey)
 );
 CREATE INDEX IX_Transfers_Subject_CreatedAt ON dbo.Transfers(Subject,CreatedAt DESC) INCLUDE(Status,AmountMinor);
 CREATE TABLE dbo.Inbox(MessageId uniqueidentifier NOT NULL PRIMARY KEY,ReceivedAt datetimeoffset NOT NULL);
 CREATE TABLE dbo.Outbox(MessageId uniqueidentifier NOT NULL PRIMARY KEY,RoutingKey varchar(64) NOT NULL,Payload nvarchar(max) NOT NULL,
  CreatedAt datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),PublishedAt datetimeoffset NULL);
 CREATE INDEX IX_Outbox_Pending ON dbo.Outbox(CreatedAt) INCLUDE(RoutingKey) WHERE PublishedAt IS NULL;
 INSERT dbo.SchemaVersions VALUES(1,SYSDATETIMEOFFSET());
END;
