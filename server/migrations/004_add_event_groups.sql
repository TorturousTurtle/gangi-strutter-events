-- Migration 004: Add event_group column to event_options table
-- Allows grouping related events under a shared header (e.g., "2-Baton" group)
--
-- Run with: mysql -u USERNAME -p DATABASE < server/migrations/004_add_event_groups.sql

-- Add event_group column to event_options
ALTER TABLE event_options
  ADD COLUMN event_group VARCHAR(100) NULL COMMENT 'Optional sub-group name for related events (e.g., 2-Baton)' AFTER category_order;

-- Add index for event_group lookups
CREATE INDEX idx_event_options_event_group ON event_options (event_group);
