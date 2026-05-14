<?php
/**
 * PayPal webhook endpoint.
 * Handles PayPal events like CHECKOUT.ORDER.APPROVED.
 *
 * POST /api/paypal/webhook.php
 */

require_once __DIR__ . '/../util.php';
require_once __DIR__ . '/../../../server/lib/Settings.php';
require_once __DIR__ . '/../../../server/lib/PaymentProvider/PaymentProviderFactory.php';

use PaymentProvider\PaymentProviderFactory;

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

// Create PayPal provider
$factory = new PaymentProviderFactory($settings, $pdo);
$provider = $factory->getProvider('paypal');

if (!$provider) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to create PayPal provider']);
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
    error_log('PayPal webhook error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
