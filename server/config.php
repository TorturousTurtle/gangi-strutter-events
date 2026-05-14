<?php
/**
 * Application Configuration
 *
 * Loads configuration from environment variables.
 * See .env.example for available configuration options.
 */

require_once __DIR__ . '/lib/Env.php';

// Load environment variables
Env::load();

return [
    'db' => [
        'host'    => Env::get('DB_HOST', 'localhost'),
        'name'    => Env::get('DB_NAME', 'competition_events'),
        'user'    => Env::get('DB_USER', 'root'),
        'pass'    => Env::get('DB_PASS', ''),
        'charset' => Env::get('DB_CHARSET', 'utf8mb4'),
    ],

    'admin' => [
        'user' => Env::get('ADMIN_USER', 'admin'),
        'pass' => Env::get('ADMIN_PASS', ''),        // Deprecated: use pass_hash
        'pass_hash' => Env::get('ADMIN_PASS_HASH', ''),
    ],

    'stripe' => [
        'secret_key'      => Env::get('STRIPE_SECRET_KEY', ''),
        'publishable_key' => Env::get('STRIPE_PUBLISHABLE_KEY', ''),
        'webhook_secret'  => Env::get('STRIPE_WEBHOOK_SECRET', ''),
    ],

    'app' => [
        'env'   => Env::get('APP_ENV', 'production'),
        'url'   => Env::get('APP_URL', ''),
        'debug' => Env::getBool('APP_DEBUG', false),
    ],

    'mail' => [
        'host'         => Env::get('SMTP_HOST', ''),
        'port'         => Env::getInt('SMTP_PORT', 587),
        'user'         => Env::get('SMTP_USER', ''),
        'pass'         => Env::get('SMTP_PASS', ''),
        'from_address' => Env::get('SMTP_FROM_ADDRESS', ''),
        'from_name'    => Env::get('SMTP_FROM_NAME', ''),
    ],
];
