<?php
/**
 * Admin endpoint to save settings.
 *
 * POST /api/settings/save.php
 *
 * Request body:
 * {
 *   "settings": {
 *     "payment_provider": "stripe",
 *     "stripe_publishable_key": "pk_test_...",
 *     "stripe_secret_key": "sk_test_..." // Only if changed (not masked)
 *   },
 *   "testConnection": true // Optional: test provider connection after saving
 * }
 *
 * Response:
 * {
 *   "ok": true,
 *   "message": "Settings saved successfully",
 *   "connectionTest": { "success": true, "message": "Connected to Stripe" }
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
$newSettings = $body['settings'] ?? [];
$category = $body['category'] ?? 'payment';
$testConnection = $body['testConnection'] ?? false;

if (empty($newSettings) || !is_array($newSettings)) {
    json_response(['ok' => false, 'error' => 'No settings provided'], 400);
}

// Allowed settings keys by category
$allowedKeysByCategory = [
    'payment' => [
        'payment_provider',
        'pay_later_enabled',
        'pay_later_instructions',
        // Stripe
        'stripe_mode',
        'stripe_publishable_key',
        'stripe_secret_key',
        'stripe_webhook_secret',
        // PayPal
        'paypal_mode',
        'paypal_client_id',
        'paypal_client_secret',
        // Square
        'square_mode',
        'square_application_id',
        'square_access_token',
        'square_location_id',
    ],
    'branding' => [
        'organizationName',
        'tagline',
        'primaryColor',
        'secondaryColor',
        'logoUrl',
        'logoDarkUrl',
        'faviconUrl',
        'headerStyle',
        'footerText',
    ],
];

$allowedKeys = $allowedKeysByCategory[$category] ?? [];

if (empty($allowedKeys)) {
    json_response(['ok' => false, 'error' => 'Invalid settings category'], 400);
}

// Validate payment provider
if (isset($newSettings['payment_provider'])) {
    $validProviders = ['none', 'stripe', 'paypal', 'square'];
    if (!in_array($newSettings['payment_provider'], $validProviders, true)) {
        json_response(['ok' => false, 'error' => 'Invalid payment provider'], 400);
    }
}

// Validate branding colors
if ($category === 'branding') {
    if (isset($newSettings['primaryColor']) && !Settings::isValidHexColor($newSettings['primaryColor'])) {
        json_response(['ok' => false, 'error' => 'Invalid primary color format. Use hex format like #6366f1'], 400);
    }
    if (isset($newSettings['secondaryColor']) && !Settings::isValidHexColor($newSettings['secondaryColor'])) {
        json_response(['ok' => false, 'error' => 'Invalid secondary color format. Use hex format like #f59e0b'], 400);
    }
}

// Save settings
try {
    $pdo->beginTransaction();

    if ($category === 'branding') {
        // Use the saveBrandingConfig method for branding settings
        $filteredSettings = [];
        foreach ($newSettings as $key => $value) {
            if (in_array($key, $allowedKeys, true)) {
                $filteredSettings[$key] = $value;
            }
        }
        $settings->saveBrandingConfig($filteredSettings);
    } else {
        // Save payment/other settings individually
        foreach ($newSettings as $key => $value) {
            // Skip disallowed keys
            if (!in_array($key, $allowedKeys, true)) {
                continue;
            }

            // Skip masked values (contain asterisks) - these weren't changed
            if (is_string($value) && strpos($value, '****') !== false) {
                continue;
            }

            // Handle boolean conversion
            if ($key === 'pay_later_enabled') {
                $value = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? '1' : '0';
            }

            // Handle empty strings as null for optional fields
            if ($value === '' && !in_array($key, ['payment_provider', 'stripe_mode', 'paypal_mode', 'square_mode'], true)) {
                $value = null;
            }

            $settings->set($key, $value, $category);
        }
    }

    $pdo->commit();
    $settings->clearCache();

    $result = [
        'ok' => true,
        'message' => 'Settings saved successfully',
    ];

    // Test connection if requested
    if ($testConnection) {
        $provider = $newSettings['payment_provider'] ?? $settings->get('payment_provider', 'none');

        if ($provider && $provider !== 'none') {
            $factory = new PaymentProviderFactory($settings, $pdo);
            $providerInstance = $factory->getProvider($provider);

            if ($providerInstance) {
                $result['connectionTest'] = $providerInstance->testConnection();
            }
        }
    }

    json_response($result);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('Settings save failed: ' . $e->getMessage());
    json_response([
        'ok' => false,
        'error' => 'Failed to save settings: ' . $e->getMessage(),
    ], 500);
}
