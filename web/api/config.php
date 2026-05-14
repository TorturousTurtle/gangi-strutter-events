<?php
/**
 * Public Configuration API
 *
 * Returns safe-to-expose configuration for the frontend.
 * Does NOT expose secrets (database credentials, API keys, etc.)
 */

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, If-None-Match');
header('Cache-Control: public, max-age=300'); // Cache for 5 minutes

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

/**
 * Check ETag and return 304 Not Modified if content hasn't changed.
 *
 * @param string $content JSON content to check
 * @return void Exits with 304 if ETag matches
 */
function checkEtag(string $content): void
{
    $etag = '"' . md5($content) . '"';
    header("ETag: $etag");

    // Check If-None-Match header
    $ifNoneMatch = $_SERVER['HTTP_IF_NONE_MATCH'] ?? '';

    // Handle multiple ETags in If-None-Match (comma-separated)
    $clientEtags = array_map('trim', explode(',', $ifNoneMatch));

    if (in_array($etag, $clientEtags, true) || in_array('*', $clientEtags, true)) {
        http_response_code(304);
        exit;
    }
}

require_once __DIR__ . '/../../server/lib/Env.php';
require_once __DIR__ . '/../../server/lib/Features.php';

Env::load();
Features::load();

// Load tenant config if it exists
$tenantConfigPath = dirname(__DIR__, 2) . '/config/tenant.json';
$tenantConfig = [];
if (file_exists($tenantConfigPath)) {
    $tenantConfig = json_decode(file_get_contents($tenantConfigPath), true) ?? [];
}

// Build public configuration response
$config = [
    'organization' => $tenantConfig['organization'] ?? [
        'name' => 'GKP Events',
        'legalName' => 'Gangi Kupras Productions LLC',
        'tagline' => 'Competition Registration Made Simple',
        'website' => '',
        'supportEmail' => '',
        'timezone' => 'America/New_York',
    ],

    'branding' => $tenantConfig['branding'] ?? [
        'logo' => '/assets/gkp-logo.png',
        'favicon' => '/favicon.ico',
        'colors' => [
            'primary' => '#0b5cff',
            'primaryHover' => '#0849c6',
            'accent' => '#e9c001',
            'accentHover' => '#d4af01',
            'success' => '#10b981',
            'warning' => '#f59e0b',
            'error' => '#ef4444',
            'background' => '#f8fafc',
            'surface' => '#ffffff',
            'text' => '#111827',
            'textMuted' => '#6b7280',
            'headerBg' => null, // null = use gradient from primary colors
            'headerText' => '#ffffff',
            'footerBg' => '#4a4a4a',
            'footerText' => '#e5e7eb',
        ],
        'fonts' => [
            'heading' => "'Inter', system-ui, sans-serif",
            'body' => "'Inter', system-ui, sans-serif",
        ],
    ],

    'terminology' => $tenantConfig['terminology'] ?? [
        'participant' => 'Twirler',
        'participantPlural' => 'Twirlers',
        'instructor' => 'Coach',
        'instructorPlural' => 'Coaches',
        'group' => 'Team',
        'groupPlural' => 'Teams',
        'event' => 'Event',
        'eventPlural' => 'Events',
        'competition' => 'Competition',
        'competitionPlural' => 'Competitions',
    ],

    'features' => Features::all(),

    'registration' => $tenantConfig['registration'] ?? [
        'requirePhone' => true,
        'requireEmail' => true,
        'requireDateOfBirth' => true,
        'requireGender' => true,
        'requireCoach' => true,
        'requireTeam' => true,
        'allowOtherCoach' => true,
        'maxEventsPerRegistrant' => null,
        'minEventsPerRegistrant' => 1,
    ],

    'fees' => $tenantConfig['fees'] ?? [
        'processingFeePercent' => 2.9,
        'processingFeeFlat' => 0.30,
        'passProcessingFeeToCustomer' => true,
    ],

    'legal' => $tenantConfig['legal'] ?? [
        'termsUrl' => '/terms',
        'privacyUrl' => '/privacy',
        'waiverRequired' => false,
    ],

    'app' => [
        'env' => Env::get('APP_ENV', 'production'),
        'debug' => Env::getBool('APP_DEBUG', false),
    ],
];

$response = json_encode([
    'ok' => true,
    'config' => $config,
]);

// Check ETag and return 304 if unchanged
checkEtag($response);

echo $response;
