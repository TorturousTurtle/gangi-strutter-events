<?php
// web/api/admin-export.php
// Admin: export registrations as CSV for a competition (defaults to current)

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/admin_auth.php';

// Prevent warnings/notices (often HTML-formatted) from corrupting CSV downloads.
// We still log errors server-side, but we don't echo them into the CSV response.
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('html_errors', '0');
error_reporting(E_ALL & ~E_DEPRECATED & ~E_STRICT);

// Some hosts force display_errors on; swallow deprecation notices so CSV output stays clean.
set_error_handler(function ($errno, $errstr) {
  if ($errno === E_DEPRECATED || $errno === E_USER_DEPRECATED) {
    return true; // handled (suppress)
  }
  return false; // let PHP handle everything else
});

allow_cors();
require_admin_auth();
require_method('GET');

$pdo = require __DIR__ . '/db.php';

// Optional explicit competition_id
$competitionId = isset($_GET['competition_id']) ? (int)$_GET['competition_id'] : 0;

if ($competitionId <= 0) {
  $stmt = $pdo->query("SELECT id, name FROM competitions WHERE is_current = 1 ORDER BY id DESC LIMIT 1");
  $row = $stmt->fetch();
  $competitionId = $row ? (int)$row['id'] : 0;
  $competitionName = $row ? (string)$row['name'] : 'competition';
} else {
  $stmt = $pdo->prepare("SELECT name FROM competitions WHERE id = ? LIMIT 1");
  $stmt->execute([$competitionId]);
  $row = $stmt->fetch();
  $competitionName = $row ? (string)$row['name'] : 'competition';
}

// If nothing selected / no current competition
if ($competitionId <= 0) {
  http_response_code(200);
  // Ensure nothing has been echoed before headers/CSV.
  while (ob_get_level()) { ob_end_clean(); }
  header('Content-Type: text/csv; charset=UTF-8');
  header('Content-Disposition: attachment; filename="registrations.csv"');
  $out = fopen('php://output', 'w');
  fputcsv($out, ['id','competition_id','first_name','last_name','coach_name','team_name','age_division','email','home_phone','events','event_subtotal','facility_fee','event_total','created_at'], ',', '"', '\\');
  fclose($out);
  restore_error_handler();
  exit;
}

// Detect optional team_name column
$hasTeam = false;
try {
  $chk = $pdo->query("SHOW COLUMNS FROM registrations LIKE 'team_name'");
  $hasTeam = (bool)$chk->fetch();
} catch (Throwable $e) {
  $hasTeam = false;
}

// Detect custom_data_json column
$hasCustomData = false;
try {
  $chk = $pdo->query("SHOW COLUMNS FROM registrations LIKE 'custom_data_json'");
  $hasCustomData = (bool)$chk->fetch();
} catch (Throwable $e) {
  $hasCustomData = false;
}

// Load field configuration to get custom field definitions
$customFieldDefs = [];
$fieldsConfigPath = dirname(__DIR__, 2) . '/config/fields.json';
if (file_exists($fieldsConfigPath)) {
  $fieldsJson = file_get_contents($fieldsConfigPath);
  $fieldsConfig = json_decode($fieldsJson, true);
  if (is_array($fieldsConfig) && isset($fieldsConfig['fields'])) {
    foreach ($fieldsConfig['fields'] as $field) {
      if (isset($field['storage']) && $field['storage'] === 'custom' && !empty($field['id'])) {
        $customFieldDefs[$field['id']] = [
          'id' => $field['id'],
          'label' => $field['label'] ?? $field['id'],
        ];
      }
    }
  }
}

// Load competition-specific field config for additional custom fields
if ($competitionId > 0) {
  $stmt = $pdo->prepare("SELECT fields_config_json FROM competitions WHERE id = ?");
  $stmt->execute([$competitionId]);
  $compRow = $stmt->fetch();
  if ($compRow && !empty($compRow['fields_config_json'])) {
    $compFieldsConfig = json_decode($compRow['fields_config_json'], true);
    // Check for custom fields added via admin UI
    if (is_array($compFieldsConfig)) {
      $customFieldsArray = $compFieldsConfig['customFields'] ?? $compFieldsConfig['fields'] ?? [];
      foreach ($customFieldsArray as $field) {
        if (isset($field['storage']) && $field['storage'] === 'custom' && !empty($field['id']) && !empty($field['label'])) {
          $customFieldDefs[$field['id']] = [
            'id' => $field['id'],
            'label' => $field['label'],
          ];
        }
      }
    }
  }
}

$selectCols = [
  'id',
  'competition_id',
  'first_name',
  'last_name',
  'coach_name',
];
if ($hasTeam) $selectCols[] = 'team_name';
$selectCols = array_merge($selectCols, [
  'age_division',
  'email',
  'home_phone',
  'event_selections_json',
  'event_subtotal',
  'facility_fee',
  'event_total',
  'created_at',
]);
if ($hasCustomData) $selectCols[] = 'custom_data_json';

$stmt = $pdo->prepare(
  "SELECT " . implode(', ', $selectCols) . " FROM registrations WHERE competition_id = ? ORDER BY created_at DESC, id DESC"
);
$stmt->execute([$competitionId]);
$rows = $stmt->fetchAll();

// Map option ids -> names (for cases where selections json only stores ids)
$allOptionIds = [];
$decodedSelectionsByRegId = [];

foreach ($rows as $r) {
  $selRaw = $r['event_selections_json'] ?? '';
  $sels = [];

  if (is_string($selRaw) && trim($selRaw) !== '') {
    $tmp = json_decode($selRaw, true);
    if (is_array($tmp)) {
      foreach ($tmp as $item) {
        if (!is_array($item)) continue;
        $id = isset($item['id']) ? (int)$item['id'] : 0;
        $name = isset($item['name']) ? (string)$item['name'] : '';
        $price = isset($item['price']) ? (float)$item['price'] : 0.0;
        if ($id > 0) $allOptionIds[$id] = true;
        $sels[] = ['id' => $id, 'name' => $name, 'price' => $price];
      }
    }
  }

  $decodedSelectionsByRegId[(int)$r['id']] = $sels;
}

$optionNameById = [];
$ids = array_keys($allOptionIds);
if (count($ids) > 0) {
  $placeholders = implode(',', array_fill(0, count($ids), '?'));
  $stmt = $pdo->prepare("SELECT id, name FROM event_options WHERE id IN ($placeholders)");
  $stmt->execute($ids);
  foreach ($stmt->fetchAll() as $o) {
    $optionNameById[(int)$o['id']] = (string)$o['name'];
  }
}

// Output CSV
$slug = preg_replace('/[^a-zA-Z0-9\-_]+/', '-', strtolower($competitionName));
$filename = 'registrations-' . $slug . '-' . date('Y-m-d') . '.csv';

// Ensure nothing has been echoed before headers/CSV.
while (ob_get_level()) { ob_end_clean(); }

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');

$out = fopen('php://output', 'w');

$header = ['id','competition_id','first_name','last_name','coach_name'];
$header[] = 'team_name';
$header = array_merge($header, ['age_division','email','home_phone','events','event_subtotal','facility_fee','event_total','created_at']);

// Add custom field headers
foreach ($customFieldDefs as $fieldDef) {
  $header[] = $fieldDef['label'];
}

fputcsv($out, $header, ',', '"', '\\');

foreach ($rows as $r) {
  $rid = (int)$r['id'];
  $sels = $decodedSelectionsByRegId[$rid] ?? [];
  $eventNames = [];

  foreach ($sels as $s) {
    $sid = isset($s['id']) ? (int)$s['id'] : 0;
    $sname = isset($s['name']) ? trim((string)$s['name']) : '';
    if ($sname === '' && $sid > 0 && isset($optionNameById[$sid])) {
      $sname = $optionNameById[$sid];
    }
    if ($sname !== '') $eventNames[] = $sname;
  }

  $line = [
    (int)$r['id'],
    (int)$r['competition_id'],
    (string)$r['first_name'],
    (string)$r['last_name'],
    (string)($r['coach_name'] ?? ''),
    (string)($r['team_name'] ?? ''),
    (string)($r['age_division'] ?? ''),
    (string)$r['email'],
    (string)($r['home_phone'] ?? ''),
    implode(' | ', $eventNames),
    (string)$r['event_subtotal'],
    (string)$r['facility_fee'],
    (string)$r['event_total'],
    (string)$r['created_at'],
  ];

  // Add custom field values
  $customData = [];
  if ($hasCustomData && !empty($r['custom_data_json'])) {
    $decoded = json_decode($r['custom_data_json'], true);
    if (is_array($decoded)) {
      $customData = $decoded;
    }
  }
  foreach ($customFieldDefs as $fieldId => $fieldDef) {
    $value = $customData[$fieldId] ?? '';
    // Handle arrays (e.g., multi-select) by joining with commas
    if (is_array($value)) {
      $value = implode(', ', $value);
    }
    $line[] = (string)$value;
  }

  fputcsv($out, $line, ',', '"', '\\');
}

fclose($out);
restore_error_handler();
exit;
