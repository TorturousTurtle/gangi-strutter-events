<?php
/**
 * Registration Fields API
 *
 * Returns the field configuration schema for the registration form.
 * Merges base config with any competition-specific overrides.
 */

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, If-None-Match');
header('Cache-Control: public, max-age=60');

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
Env::load();

// Load base field configuration
$fieldsConfigPath = dirname(__DIR__, 2) . '/config/fields.json';
$fieldsConfig = [];

if (file_exists($fieldsConfigPath)) {
    $json = file_get_contents($fieldsConfigPath);
    $fieldsConfig = json_decode($json, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Failed to parse fields configuration']);
        exit;
    }
}

// Get terminology from config API or use defaults
$terminology = $fieldsConfig['terminology'] ?? [
    'participant' => 'Twirler',
    'participantPlural' => 'Twirlers',
    'instructor' => 'Coach',
    'instructorPlural' => 'Coaches',
    'group' => 'Team',
    'groupPlural' => 'Teams',
];

// Optional: Load competition-specific field overrides
// This would allow per-competition field customization stored in the database
$competitionId = isset($_GET['competition_id']) ? (int)$_GET['competition_id'] : null;

if ($competitionId) {
    try {
        $pdo = require __DIR__ . '/db.php';

        $stmt = $pdo->prepare("SELECT fields_config_json FROM competitions WHERE id = ?");
        $stmt->execute([$competitionId]);
        $row = $stmt->fetch();

        if ($row && !empty($row['fields_config_json'])) {
            $overrides = json_decode($row['fields_config_json'], true);
            if (is_array($overrides)) {
                // Merge overrides into base config
                // For now, just override enabled status and order
                if (isset($overrides['fields']) && is_array($overrides['fields'])) {
                    $overrideById = [];
                    foreach ($overrides['fields'] as $f) {
                        if (isset($f['id'])) {
                            $overrideById[$f['id']] = $f;
                        }
                    }

                    foreach ($fieldsConfig['fields'] as &$field) {
                        $id = $field['id'] ?? '';
                        if (isset($overrideById[$id])) {
                            // Merge specific overridable properties
                            $override = $overrideById[$id];
                            if (isset($override['enabled'])) {
                                $field['enabled'] = (bool)$override['enabled'];
                            }
                            if (isset($override['required'])) {
                                $field['required'] = (bool)$override['required'];
                            }
                            if (isset($override['order'])) {
                                $field['order'] = (int)$override['order'];
                            }
                            if (isset($override['label'])) {
                                $field['label'] = $override['label'];
                            }
                        }
                    }
                    unset($field);
                }

                // Override terminology if provided
                if (isset($overrides['terminology']) && is_array($overrides['terminology'])) {
                    $terminology = array_merge($terminology, $overrides['terminology']);
                }
            }
        }
    } catch (Throwable $e) {
        // Silently continue with base config if DB lookup fails
    }
}

// Update terminology in output
$fieldsConfig['terminology'] = $terminology;

$response = json_encode([
    'ok' => true,
    'config' => $fieldsConfig,
]);

// Check ETag and return 304 if unchanged
checkEtag($response);

echo $response;
