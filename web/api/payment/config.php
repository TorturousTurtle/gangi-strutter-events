<?php
/**
 * Public payment configuration endpoint.
 * Returns client-safe payment configuration for the frontend.
 *
 * GET /api/payment/config.php
 *
 * Response:
 * {
 *   "ok": true,
 *   "provider": "stripe",
 *   "payLaterEnabled": true,
 *   "payLaterInstructions": "...",
 *   "stripePublishableKey": "pk_test_...",
 *   "stripeMode": "test"
 * }
 */

require_once __DIR__ . '/../util.php';
require_once __DIR__ . '/../../../server/lib/Settings.php';
require_once __DIR__ . '/../../../server/lib/PaymentProvider/PaymentProviderFactory.php';

use PaymentProvider\PaymentProviderFactory;

allow_cors();
require_method('GET');

$pdo = require __DIR__ . '/../db.php';
$settings = new Settings($pdo);

// Check if settings table exists
if (!$settings->tableExists()) {
    json_response([
        'ok' => true,
        'provider' => 'none',
        'payLaterEnabled' => false,
        'configured' => false,
        'message' => 'Payment settings not configured. Please run database migration.',
    ]);
}

// Get public payment configuration
$config = $settings->getPaymentConfig();

// Add overall configuration status
$factory = new PaymentProviderFactory($settings, $pdo);
$activeProvider = $factory->getActiveProvider();

$config['ok'] = true;
$config['configured'] = $activeProvider ? $activeProvider->isConfigured() : false;
$config['hasPaymentOption'] = $config['configured'] || $config['payLaterEnabled'];

json_response($config);
