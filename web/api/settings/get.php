<?php
/**
 * Admin endpoint to read settings.
 *
 * GET /api/settings/get.php?category=payment
 *
 * Response:
 * {
 *   "ok": true,
 *   "settings": {
 *     "payment_provider": "stripe",
 *     "stripe_publishable_key": "pk_test_...",
 *     "stripe_secret_key": "sk_test_...****", // Masked
 *     ...
 *   },
 *   "providerStatus": {
 *     "stripe": { "configured": true, "active": true },
 *     ...
 *   }
 * }
 */

require_once __DIR__ . '/../util.php';
require_once __DIR__ . '/../admin_auth.php';
require_once __DIR__ . '/../../../server/lib/Settings.php';
require_once __DIR__ . '/../../../server/lib/PaymentProvider/PaymentProviderFactory.php';

use PaymentProvider\PaymentProviderFactory;

allow_cors();
require_admin_auth();
require_method('GET');

$pdo = require __DIR__ . '/../db.php';
$settings = new Settings($pdo);

// Check if settings table exists
if (!$settings->tableExists()) {
    json_response([
        'ok' => false,
        'error' => 'Settings table does not exist. Please run database migration.',
    ], 500);
}

$category = $_GET['category'] ?? 'payment';

// Get settings for the category
$allSettings = $settings->getByCategory($category);

// For payment settings, also get general payment config
if ($category === 'payment') {
    // Add settings that might be under 'general' category
    $allSettings['payment_provider'] = $settings->get('payment_provider', 'none');
    $allSettings['pay_later_enabled'] = $settings->getBool('pay_later_enabled', false) ? '1' : '0';
    $allSettings['pay_later_instructions'] = $settings->get('pay_later_instructions', '');

    // Stripe
    $allSettings['stripe_mode'] = $settings->get('stripe_mode', 'test');
    $allSettings['stripe_publishable_key'] = $settings->get('stripe_publishable_key', '');
    $allSettings['stripe_secret_key'] = maskSecret($settings->get('stripe_secret_key', ''));
    $allSettings['stripe_webhook_secret'] = maskSecret($settings->get('stripe_webhook_secret', ''));

    // PayPal
    $allSettings['paypal_mode'] = $settings->get('paypal_mode', 'sandbox');
    $allSettings['paypal_client_id'] = $settings->get('paypal_client_id', '');
    $allSettings['paypal_client_secret'] = maskSecret($settings->get('paypal_client_secret', ''));

    // Square
    $allSettings['square_mode'] = $settings->get('square_mode', 'sandbox');
    $allSettings['square_application_id'] = $settings->get('square_application_id', '');
    $allSettings['square_access_token'] = maskSecret($settings->get('square_access_token', ''));
    $allSettings['square_location_id'] = $settings->get('square_location_id', '');

    // Get provider status
    $factory = new PaymentProviderFactory($settings, $pdo);
    $providerStatus = $factory->getAllProviderStatus();
} elseif ($category === 'branding') {
    // Get branding configuration
    $allSettings = $settings->getBrandingConfig();
    $providerStatus = [];
} else {
    $providerStatus = [];
}

json_response([
    'ok' => true,
    'settings' => $allSettings,
    'providerStatus' => $providerStatus,
    'providers' => PaymentProviderFactory::getProviderDisplayNames(),
]);

/**
 * Mask a secret key for display (show first 8 and last 4 chars).
 */
function maskSecret(string $value): string
{
    if ($value === '') {
        return '';
    }

    $len = strlen($value);
    if ($len <= 12) {
        return str_repeat('*', $len);
    }

    return substr($value, 0, 8) . str_repeat('*', $len - 12) . substr($value, -4);
}
