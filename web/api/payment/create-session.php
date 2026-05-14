<?php
/**
 * Unified payment session creation endpoint.
 * Routes to the appropriate payment provider based on settings.
 *
 * POST /api/payment/create-session.php
 *
 * Request body:
 * {
 *   "registration": { ... registration data ... },
 *   "pricing": { ... computed pricing ... },
 *   "successUrl": "http://...",
 *   "cancelUrl": "http://...",
 *   "provider": "stripe" | "paypal" | "square" | "manual" (optional, uses active if not specified)
 * }
 *
 * Response:
 * {
 *   "ok": true,
 *   "url": "https://checkout.stripe.com/...",
 *   "transactionId": 123,
 *   "provider": "stripe"
 * }
 */

require_once __DIR__ . '/../util.php';
require_once __DIR__ . '/../../../server/lib/Settings.php';
require_once __DIR__ . '/../../../server/lib/PaymentProvider/PaymentProviderFactory.php';

use PaymentProvider\PaymentProviderFactory;

allow_cors();
require_method('POST');

$pdo = require __DIR__ . '/../db.php';
$settings = new Settings($pdo);

// Check if settings table exists
if (!$settings->tableExists()) {
    json_response([
        'ok' => false,
        'error' => 'Payment settings not configured. Please run database migration.',
    ], 500);
}

$body = read_json_body();

$registration = $body['registration'] ?? [];
$pricing = $body['pricing'] ?? [];
$successUrl = $body['successUrl'] ?? '';
$cancelUrl = $body['cancelUrl'] ?? '';
$requestedProvider = $body['provider'] ?? null;

// Validate required fields
if (empty($registration)) {
    json_response(['ok' => false, 'error' => 'Missing registration data'], 400);
}

if (empty($pricing['totalWithProcessing'])) {
    json_response(['ok' => false, 'error' => 'Missing pricing data'], 400);
}

$email = $registration['email'] ?? '';
if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['ok' => false, 'error' => 'Valid email is required'], 400);
}

// Get payment provider
$factory = new PaymentProviderFactory($settings, $pdo);

if ($requestedProvider === 'manual') {
    // Explicitly requesting Pay Later
    $provider = $factory->getManualProvider();
    if (!$provider) {
        json_response(['ok' => false, 'error' => 'Pay Later option is not enabled'], 400);
    }
} elseif ($requestedProvider) {
    // Specific provider requested
    $provider = $factory->getProvider($requestedProvider);
    if (!$provider) {
        json_response(['ok' => false, 'error' => 'Invalid payment provider: ' . $requestedProvider], 400);
    }
} else {
    // Use active provider
    $provider = $factory->getActiveProvider();
    if (!$provider) {
        json_response(['ok' => false, 'error' => 'No payment provider configured'], 400);
    }
}

if (!$provider->isConfigured()) {
    json_response([
        'ok' => false,
        'error' => 'Payment provider is not properly configured',
    ], 500);
}

// Create payment session
try {
    $result = $provider->createPaymentSession(
        $registration,
        $pricing,
        [
            'successUrl' => $successUrl,
            'cancelUrl' => $cancelUrl,
        ]
    );

    json_response([
        'ok' => true,
        'url' => $result['url'] ?? $result['redirectUrl'] ?? null,
        'transactionId' => $result['transactionId'] ?? null,
        'sessionId' => $result['id'] ?? null,
        'provider' => $provider->getName(),
        'requiresPayment' => $result['requiresPayment'] ?? true,
    ]);
} catch (Throwable $e) {
    error_log('Payment session creation failed: ' . $e->getMessage());
    json_response([
        'ok' => false,
        'error' => 'Failed to create payment session: ' . $e->getMessage(),
    ], 500);
}
