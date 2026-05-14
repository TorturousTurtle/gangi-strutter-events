-- Migration 006: Branding Settings
-- Adds branding-related settings for admin customization of colors, logos, and organization info
-- Run: mysql -u USER -p DATABASE < 006_branding_settings.sql

-- Insert branding settings with defaults
-- These will be customizable via Admin > Settings > Branding

INSERT INTO settings (setting_key, setting_value, is_encrypted, category) VALUES
  -- Organization Info
  ('brand_organization_name', 'GKP Events', 0, 'branding'),
  ('brand_tagline', 'Competition Registration Made Simple', 0, 'branding'),

  -- Colors (hex format)
  ('brand_primary_color', '#6366f1', 0, 'branding'),
  ('brand_secondary_color', '#f59e0b', 0, 'branding'),

  -- Logos (URLs - stored as paths relative to web root or absolute URLs)
  ('brand_logo_url', '', 0, 'branding'),
  ('brand_logo_dark_url', '', 0, 'branding'),
  ('brand_favicon_url', '', 0, 'branding'),

  -- Additional branding options
  ('brand_header_style', 'gradient', 0, 'branding'),  -- 'gradient', 'solid', 'transparent'
  ('brand_footer_text', '', 0, 'branding')
ON DUPLICATE KEY UPDATE
  setting_key = setting_key;  -- No-op if already exists

-- Create uploads directory tracking (for logo uploads)
-- This helps track uploaded files for cleanup

CREATE TABLE IF NOT EXISTS uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INT NOT NULL,
    upload_path VARCHAR(500) NOT NULL,
    purpose VARCHAR(50) NOT NULL DEFAULT 'general',  -- 'logo', 'favicon', 'general'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_purpose (purpose),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
