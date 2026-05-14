-- Migration: 009_audit_log
-- Description: Create audit_log table for tracking admin actions
-- Date: 2026-02-04

CREATE TABLE IF NOT EXISTS audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(50) NOT NULL COMMENT 'Action type: login_success, login_failed, logout, competition_create, etc.',
    entity_type VARCHAR(50) NULL COMMENT 'Type of entity affected: competition, registration, settings, etc.',
    entity_id INT NULL COMMENT 'ID of the affected entity',
    actor_ip VARCHAR(45) NOT NULL COMMENT 'IP address of the actor (supports IPv6)',
    actor_user VARCHAR(100) NULL COMMENT 'Username if authenticated',
    details JSON NULL COMMENT 'Additional details as JSON (sensitive values should be masked)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created (created_at),
    INDEX idx_actor_ip (actor_ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
