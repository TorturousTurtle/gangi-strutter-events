-- Migration 010: Multi-competition display on home page
-- Adds fields to control which competitions appear on the home page and in what order

-- Show on home page flag (default false for existing competitions)
ALTER TABLE competitions ADD COLUMN show_on_home TINYINT(1) NOT NULL DEFAULT 0 AFTER image_url;

-- Display order (lower numbers appear first)
ALTER TABLE competitions ADD COLUMN display_order INT NOT NULL DEFAULT 0 AFTER show_on_home;

-- Index for efficient home page queries
CREATE INDEX idx_competitions_home_display ON competitions (show_on_home, display_order, start_at);

-- Set the current active competition to show on home by default
UPDATE competitions SET show_on_home = 1 WHERE is_current = 1;
