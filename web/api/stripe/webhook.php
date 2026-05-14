<?php
/**
 * Stripe webhook endpoint.
 * Handles Stripe events like checkout.session.completed.
 *
 * POST /api/stripe/webhook.php
 */

require_once __DIR__ . '/../util.php';
require_once __DIR__ . '/../../../server/lib/Settings.php';
require_once __DIR__ . '/../../../server/lib/PaymentProvider/PaymentProviderFactory.php';

use PaymentProvider\PaymentProviderFactory;

// Note: Do NOT allow_cors() for webhooks - they come from Stripe's servers
// Note: Do NOT require admin auth - webhook signature is the authentication

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo 'Method not allowed';
    exit;
}

$pdo = require __DIR__ . '/../db.php';
$settings = new Settings($pdo);

// Get raw payload before any processing
$payload = file_get_contents('php://input');
$headers = getallheaders();

// Create Stripe provider
$factory = new PaymentProviderFactory($settings, $pdo);
$provider = $factory->getProvider('stripe');

if (!$provider) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to create Stripe provider']);
    exit;
}

try {
    $result = $provider->handleWebhook($payload, $headers);

    http_response_code(200);
    echo json_encode([
        'received' => true,
        'event_type' => $result['event_type'] ?? 'unknown',
    ]);
} catch (Throwable $e) {
    error_log('Stripe webhook error: ' . $e->getMessage());

    // Return 400 for signature errors so Stripe knows to retry
    $code = strpos($e->getMessage(), 'signature') !== false ? 400 : 500;
    http_response_code($code);
    echo json_encode(['error' => $e->getMessage()]);
}
