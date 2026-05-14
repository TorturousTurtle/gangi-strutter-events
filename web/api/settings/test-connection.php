<?php
/**
 * Admin endpoint to test payment provider connection.
 *
 * POST /api/settings/test-connection.php
 *
 * Request body:
 * {
 *   "provider": "stripe"
 * }
 *
 * Response:
 * {
 *   "ok": true,
 *   "success": true,
 *   "message": "Connected to Stripe successfully."
 * }
 */

require_once __DIR__ . '/../util.php';
require_once __DIR__ . '/../admin_auth.php';
require_once __DIR__ . '/../../../server/lib/Settings.php';
require_once __DIR__ . '/../../../server/lib/PaymentProvider/PaymentProviderFactory.php';

use PaymentProvider\PaymentProviderFactory;

allow_cors();
require_admin_auth();
require_method('POST');

$pdo = require __DIR__ . '/../db.php';
$settings = new Settings($pdo);

// Check if settings table exists
if (!$settings->tableExists()) {
    json_response([
        'ok' => false,
        'error' => 'Settings table does not exist. Please run database migration.',
    ], 500);
}

$body = read_json_body();
$providerName = $body['provider'] ?? '';

if (!$providerName || $providerName === 'none') {
    json_response(['ok' => false, 'error' => 'No provider specified'], 400);
}

$validProviders = ['stripe', 'paypal', 'square', 'manual'];
if (!in_array($providerName, $validProviders, true)) {
    json_response(['ok' => false, 'error' => 'Invalid provider: ' . $providerName], 400);
}

$factory = new PaymentProviderFactory($settings, $pdo);
$provider = $factory->getProvider($providerName);

if (!$provider) {
    json_response([
        'ok' => false,
        'error' => 'Failed to create provider instance',
    ], 500);
}

try {
    $result = $provider->testConnection();

    json_response([
        'ok' => true,
        'success' => $result['success'] ?? false,
        'message' => $result['message'] ?? 'Unknown result',
        'details' => array_diff_key($result, ['success' => 1, 'message' => 1]),
    ]);
} catch (Throwable $e) {
    json_response([
        'ok' => true,
        'success' => false,
        'message' => 'Connection test failed: ' . $e->getMessage(),
    ]);
}
