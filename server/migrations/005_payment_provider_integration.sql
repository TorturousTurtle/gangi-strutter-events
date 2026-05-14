-- Migration 005: Payment Provider Integration
-- Adds support for multiple payment providers (Stripe, PayPal, Square) with encrypted credential storage
-- and payment transaction tracking.
--
-- Run with: mysql -u USERNAME -p DATABASE < server/migrations/005_payment_provider_integration.sql

-- Settings table (encrypted credential storage)
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NULL COMMENT 'Plain text value for non-sensitive settings',
    setting_value_encrypted BLOB NULL COMMENT 'Encrypted value for sensitive settings (AES-256-GCM)',
    is_encrypted TINYINT(1) DEFAULT 0 COMMENT '1 if value is stored encrypted',
    category VARCHAR(50) DEFAULT 'general' COMMENT 'Settings category for grouping',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_settings_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment transactions (audit trail)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    registration_id INT NULL COMMENT 'FK to registrations table (NULL for orphaned transactions)',
    provider VARCHAR(20) NOT NULL COMMENT 'Payment provider: stripe, paypal, square, manual',
    provider_transaction_id VARCHAR(255) NULL COMMENT 'External transaction ID from payment provider',
    amount_cents INT NOT NULL COMMENT 'Amount in cents to avoid floating point issues',
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(30) NOT NULL COMMENT 'pending, completed, failed, refunded, etc.',
    metadata_json JSON NULL COMMENT 'Provider-specific metadata',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL COMMENT 'When payment was completed/finalized',
    INDEX idx_payment_transactions_registration (registration_id),
    INDEX idx_payment_transactions_provider (provider),
    INDEX idx_payment_transactions_status (status),
    INDEX idx_payment_transactions_provider_txn (provider_transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add payment tracking columns to registrations table
ALTER TABLE registrations
    ADD COLUMN payment_status VARCHAR(30) DEFAULT 'pending' COMMENT 'pending, completed, pending_manual, failed' AFTER event_total,
    ADD COLUMN payment_provider VARCHAR(20) NULL COMMENT 'Payment provider used: stripe, paypal, square, manual' AFTER payment_status,
    ADD COLUMN payment_transaction_id INT NULL COMMENT 'FK to payment_transactions table' AFTER payment_provider;

-- Add index for payment status queries
CREATE INDEX idx_registrations_payment_status ON registrations (payment_status);
CREATE INDEX idx_registrations_payment_provider ON registrations (payment_provider);
