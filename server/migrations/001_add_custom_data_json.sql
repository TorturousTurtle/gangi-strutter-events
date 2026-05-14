-- Migration: Add custom_data_json column to registrations table
-- This column stores flexible custom field data as JSON for dynamic form fields
-- Run with: mysql -u USERNAME -p DATABASE < server/migrations/001_add_custom_data_json.sql

-- Check if column exists before adding (MySQL 8.0+)
-- For older MySQL versions, this will error if the column exists; that's OK

SET @dbname = DATABASE();
SET @tablename = 'registrations';
SET @columnname = 'custom_data_json';
SET @preparedStatement = (
  SELECT IF(
    (
      SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @dbname
        AND TABLE_NAME = @tablename
        AND COLUMN_NAME = @columnname
    ) = 0,
    'ALTER TABLE registrations ADD COLUMN custom_data_json JSON NULL COMMENT ''Stores custom/optional field data as JSON''',
    'SELECT ''Column custom_data_json already exists'''
  )
);

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
