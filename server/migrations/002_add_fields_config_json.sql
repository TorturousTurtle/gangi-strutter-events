-- Migration: Add fields_config_json column to competitions table
-- This column stores per-competition field configuration overrides as JSON
-- Run with: mysql -u USERNAME -p DATABASE < server/migrations/002_add_fields_config_json.sql

SET @dbname = DATABASE();
SET @tablename = 'competitions';
SET @columnname = 'fields_config_json';
SET @preparedStatement = (
  SELECT IF(
    (
      SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @dbname
        AND TABLE_NAME = @tablename
        AND COLUMN_NAME = @columnname
    ) = 0,
    'ALTER TABLE competitions ADD COLUMN fields_config_json JSON NULL COMMENT ''Per-competition field configuration overrides''',
    'SELECT ''Column fields_config_json already exists'''
  )
);

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
