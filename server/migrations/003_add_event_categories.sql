-- Migration 003: Add category column to event_options table
-- Allows grouping events into categories (Solo, Team, Specialty, etc.)
--
-- Run with: mysql -u USERNAME -p DATABASE < server/migrations/003_add_event_categories.sql

-- Add category column to event_options
ALTER TABLE event_options
  ADD COLUMN category VARCHAR(50) NULL COMMENT 'Event category (e.g., Solo, Team, Specialty)' AFTER default_price,
  ADD COLUMN category_order INT DEFAULT 0 COMMENT 'Sort order within category' AFTER category;

-- Add index for category lookups
CREATE INDEX idx_event_options_category ON event_options (category);

-- Create event_categories table for category configuration
CREATE TABLE IF NOT EXISTS event_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT 'Category display name',
  slug VARCHAR(50) NOT NULL UNIQUE COMMENT 'Category identifier (e.g., solo, team)',
  description TEXT NULL COMMENT 'Optional description',
  display_order INT DEFAULT 0 COMMENT 'Sort order for display',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default categories
INSERT INTO event_categories (name, slug, description, display_order) VALUES
  ('Solo Events', 'solo', 'Individual performance events', 10),
  ('Team Events', 'team', 'Duet, trio, and team events', 20),
  ('Specialty Events', 'specialty', 'Modeling, photogenic, and other specialty categories', 30);
