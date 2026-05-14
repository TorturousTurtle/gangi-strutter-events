<?php
/**
 * GET /api/branding/config.php
 *
 * Returns public branding configuration for frontend theming.
 * This endpoint is PUBLIC (no auth required) so pages can load branding.
 */

require_once __DIR__ . '/../util.php';

allow_cors();
require_method('GET');

// Allow If-None-Match header for ETag support
header('Access-Control-Allow-Headers: Content-Type, If-None-Match');

/**
 * Check ETag and return 304 Not Modified if content hasn't changed.
 *
 * @param array $data Response data to check
 * @return void Exits with 304 if ETag matches
 */
function checkEtagAndRespond(array $data): void
{
    $json = json_encode($data);
    $etag = '"' . md5($json) . '"';

    header("ETag: $etag");
    header('Cache-Control: public, max-age=300');

    // Check If-None-Match header
    $ifNoneMatch = $_SERVER['HTTP_IF_NONE_MATCH'] ?? '';

    // Handle multiple ETags in If-None-Match (comma-separated)
    $clientEtags = array_map('trim', explode(',', $ifNoneMatch));

    if (in_array($etag, $clientEtags, true) || in_array('*', $clientEtags, true)) {
        http_response_code(304);
        exit;
    }

    // Not cached, return full response
    json_response($data);
}

$pdo = require __DIR__ . '/../db.php';

require_once __DIR__ . '/../../../server/lib/Settings.php';

$settings = new Settings($pdo);

// Check if settings table exists
if (!$settings->tableExists()) {
    // Return defaults if table doesn't exist
    checkEtagAndRespond([
        'ok' => true,
        'branding' => [
            'organizationName' => 'GKP Events',
            'tagline' => 'Competition Registration Made Simple',
            'primaryColor' => '#6366f1',
            'secondaryColor' => '#f59e0b',
            'logoUrl' => '',
            'logoDarkUrl' => '',
            'faviconUrl' => '',
            'headerStyle' => 'gradient',
            'footerText' => '',
        ],
        'css' => '',
    ]);
}

$config = $settings->getBrandingConfig();
$css = $settings->generateBrandingCSS();

checkEtagAndRespond([
    'ok' => true,
    'branding' => $config,
    'css' => $css,
]);
