<?php
// web/api/admin-export-advanced.php
// Admin: advanced CSV export with column selection, date filtering, and grouping

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/admin_auth.php';

// Prevent warnings/notices from corrupting CSV downloads
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('html_errors', '0');
error_reporting(E_ALL & ~E_DEPRECATED & ~E_STRICT);

set_error_handler(function ($errno, $errstr) {
  if ($errno === E_DEPRECATED || $errno === E_USER_DEPRECATED) {
    return true;
  }
  return false;
});

allow_cors();
require_admin_auth();
require_method('GET');

$pdo = require __DIR__ . '/db.php';

// Parse parameters
$competitionId = isset($_GET['competition_id']) ? (int)$_GET['competition_id'] : 0;
$columnsParam = isset($_GET['columns']) ? trim($_GET['columns']) : '';
$dateFrom = isset($_GET['date_from']) ? trim($_GET['date_from']) : '';
$dateTo = isset($_GET['date_to']) ? trim($_GET['date_to']) : '';
$groupBy = isset($_GET['group_by']) ? trim($_GET['group_by']) : '';

// Default to current competition if not specified
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

// Available columns mapping (CSV header -> DB field or computed)
$columnDefs = [
  'id' => ['header' => 'ID', 'field' => 'id'],
  'firstName' => ['header' => 'First Name', 'field' => 'first_name'],
  'lastName' => ['header' => 'Last Name', 'field' => 'last_name'],
  'email' => ['header' => 'Email', 'field' => 'email'],
  'homePhone' => ['header' => 'Phone', 'field' => 'home_phone'],
  'coachName' => ['header' => 'Coach Name', 'field' => 'coach_name'],
  'teamName' => ['header' => 'Team', 'field' => 'team_name'],
  'ageDivision' => ['header' => 'Age Division', 'field' => 'age_division'],
  'dateOfBirth' => ['header' => 'Date of Birth', 'field' => 'date_of_birth'],
  'gender' => ['header' => 'Gender', 'field' => 'gender'],
  'events' => ['header' => 'Events', 'field' => 'event_selections_json', 'computed' => true],
  'eventSubtotal' => ['header' => 'Event Subtotal', 'field' => 'event_subtotal'],
  'facilityFee' => ['header' => 'Facility Fee', 'field' => 'facility_fee'],
  'optionalProductName' => ['header' => 'Product Name', 'field' => 'optional_product_name'],
  'optionalProductPrice' => ['header' => 'Product Price', 'field' => 'optional_product_price'],
  'eventTotal' => ['header' => 'Total', 'field' => 'event_total'],
  'createdAt' => ['header' => 'Registration Date', 'field' => 'created_at'],
];

// Parse requested columns (default to all if empty)
$requestedColumns = [];
if ($columnsParam !== '') {
  $requestedColumns = array_filter(array_map('trim', explode(',', $columnsParam)));
}
if (empty($requestedColumns)) {
  $requestedColumns = array_keys($columnDefs);
}

// Filter to valid columns only
$validColumns = array_filter($requestedColumns, function($col) use ($columnDefs) {
  return isset($columnDefs[$col]);
});

if (empty($validColumns)) {
  $validColumns = ['id', 'firstName', 'lastName'];
}

// Detect available columns in DB
function hasColumn($pdo, $column) {
  static $cache = [];
  if (isset($cache[$column])) return $cache[$column];
  try {
    $chk = $pdo->query("SHOW COLUMNS FROM registrations LIKE '" . $column . "'");
    $cache[$column] = (bool)$chk->fetch();
  } catch (Throwable $e) {
    $cache[$column] = false;
  }
  return $cache[$column];
}

// Build SELECT clause with only available columns
$selectFields = ['id', 'competition_id'];
$fieldsToCheck = ['first_name', 'last_name', 'email', 'home_phone', 'coach_name', 'team_name',
                  'age_division', 'date_of_birth', 'gender', 'event_selections_json',
                  'event_subtotal', 'facility_fee', 'optional_product_name',
                  'optional_product_price', 'event_total', 'created_at'];

foreach ($fieldsToCheck as $field) {
  if (hasColumn($pdo, $field)) {
    $selectFields[] = $field;
  }
}

// Build WHERE clause
$whereConditions = ['competition_id = ?'];
$params = [$competitionId];

if ($dateFrom !== '') {
  $whereConditions[] = 'DATE(created_at) >= ?';
  $params[] = $dateFrom;
}

if ($dateTo !== '') {
  $whereConditions[] = 'DATE(created_at) <= ?';
  $params[] = $dateTo;
}

// Build ORDER BY clause based on grouping
$orderBy = 'created_at DESC, id DESC';
$validGroupBy = ['coach', 'ageDivision', 'event'];

if ($groupBy !== '' && in_array($groupBy, $validGroupBy)) {
  switch ($groupBy) {
    case 'coach':
      $orderBy = 'coach_name ASC, last_name ASC, first_name ASC';
      break;
    case 'ageDivision':
      $orderBy = 'age_division ASC, last_name ASC, first_name ASC';
      break;
    case 'event':
      // Event sorting will be handled post-query since it's JSON
      $orderBy = 'last_name ASC, first_name ASC';
      break;
  }
}

// Execute query
$sql = "SELECT " . implode(', ', $selectFields) . " FROM registrations WHERE " . implode(' AND ', $whereConditions) . " ORDER BY " . $orderBy;
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

// Map option ids -> names
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

// Helper to get event names string
function getEventNames($regId, $decodedSelectionsByRegId, $optionNameById) {
  $sels = $decodedSelectionsByRegId[$regId] ?? [];
  $names = [];
  foreach ($sels as $s) {
    $sid = isset($s['id']) ? (int)$s['id'] : 0;
    $sname = isset($s['name']) ? trim((string)$s['name']) : '';
    if ($sname === '' && $sid > 0 && isset($optionNameById[$sid])) {
      $sname = $optionNameById[$sid];
    }
    if ($sname !== '') $names[] = $sname;
  }
  return implode(' | ', $names);
}

// If grouping by event, expand rows (one row per event per registrant)
if ($groupBy === 'event') {
  $expandedRows = [];
  foreach ($rows as $r) {
    $rid = (int)$r['id'];
    $sels = $decodedSelectionsByRegId[$rid] ?? [];

    if (empty($sels)) {
      // Keep row with no events
      $r['_event_name'] = '(No Events)';
      $expandedRows[] = $r;
    } else {
      foreach ($sels as $s) {
        $sid = isset($s['id']) ? (int)$s['id'] : 0;
        $sname = isset($s['name']) ? trim((string)$s['name']) : '';
        if ($sname === '' && $sid > 0 && isset($optionNameById[$sid])) {
          $sname = $optionNameById[$sid];
        }
        $newRow = $r;
        $newRow['_event_name'] = $sname ?: '(Unknown Event)';
        $expandedRows[] = $newRow;
      }
    }
  }

  // Sort by event name
  usort($expandedRows, function($a, $b) {
    $cmp = strcmp($a['_event_name'], $b['_event_name']);
    if ($cmp !== 0) return $cmp;
    $cmp = strcmp($a['last_name'] ?? '', $b['last_name'] ?? '');
    if ($cmp !== 0) return $cmp;
    return strcmp($a['first_name'] ?? '', $b['first_name'] ?? '');
  });

  $rows = $expandedRows;
}

// Output CSV
$slug = preg_replace('/[^a-zA-Z0-9\-_]+/', '-', strtolower($competitionName));
$filename = 'registrations-' . $slug . '-advanced-' . date('Y-m-d') . '.csv';

while (ob_get_level()) { ob_end_clean(); }

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');

$out = fopen('php://output', 'w');

// Build header row
$header = [];
foreach ($validColumns as $col) {
  $header[] = $columnDefs[$col]['header'];
}
fputcsv($out, $header, ',', '"', '\\');

// Build data rows
foreach ($rows as $r) {
  $line = [];
  $rid = (int)$r['id'];

  foreach ($validColumns as $col) {
    $def = $columnDefs[$col];
    $field = $def['field'];

    if ($col === 'events') {
      // For event grouping, show single event; otherwise show all
      if ($groupBy === 'event' && isset($r['_event_name'])) {
        $line[] = $r['_event_name'];
      } else {
        $line[] = getEventNames($rid, $decodedSelectionsByRegId, $optionNameById);
      }
    } else {
      $value = $r[$field] ?? '';
      $line[] = (string)$value;
    }
  }

  fputcsv($out, $line, ',', '"', '\\');
}

fclose($out);
restore_error_handler();
exit;
