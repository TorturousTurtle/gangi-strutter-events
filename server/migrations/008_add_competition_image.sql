-- Migration 008: Add competition image field
-- Allows admins to upload a featured image for each competition

ALTER TABLE competitions ADD COLUMN image_url VARCHAR(500) DEFAULT NULL AFTER description;
