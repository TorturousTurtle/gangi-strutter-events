<?php
// web/api/admin-list.php
// Admin: list registrants for a competition (defaults to current competition)

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/admin_auth.php';
require_admin_auth();

allow_cors();
require_method('GET');

$pdo = require __DIR__ . '/db.php';

// Optional explicit competition_id
$competitionId = isset($_GET['competition_id']) ? (int)$_GET['competition_id'] : 0;

// Default to the current competition
if ($competitionId <= 0) {
  $stmt = $pdo->query("SELECT id FROM competitions WHERE is_current = 1 ORDER BY id DESC LIMIT 1");
  $row = $stmt->fetch();
  $competitionId = $row ? (int)$row['id'] : 0;
}

if ($competitionId <= 0) {
  json_response([
    'ok' => true,
    'competitionId' => 0,
    'registrations' => [],
  ]);
}

// Detect optional columns (keeps endpoint resilient during migrations)
$hasTeam = false;
try {
  $chk = $pdo->query("SHOW COLUMNS FROM registrations LIKE 'team_name'");
  $hasTeam = (bool)$chk->fetch();
} catch (Throwable $e) {
  $hasTeam = false;
}

// Detect optional columns (resilient during migrations)
$optionalCols = [
  'date_of_birth',
  'gender',
  'email',
  'home_phone',
  'solo_status',
  'is_duet_or_trio',
];
$hasCol = [];
foreach ($optionalCols as $c) {
  $hasCol[$c] = false;
  try {
    $chk = $pdo->query("SHOW COLUMNS FROM registrations LIKE '" . $c . "'");
    $hasCol[$c] = (bool)$chk->fetch();
  } catch (Throwable $e) {
    $hasCol[$c] = false;
  }
}

// Pull registrations
$selectCols = [
  'id',
  'competition_id',
  'first_name',
  'last_name',
  'coach_name',
];

// Add optional columns if present
foreach (['date_of_birth','gender','email','home_phone','solo_status','is_duet_or_trio'] as $c) {
  if (!empty($hasCol[$c])) $selectCols[] = $c;
}

if ($hasTeam) {
  $selectCols[] = 'team_name';
}

$selectCols = array_merge($selectCols, [
  'age_division',
  'event_selections_json',
  'event_subtotal',
  'facility_fee',
  'event_total',
  'created_at',
]);

$stmt = $pdo->prepare("
  SELECT
    " . implode(",\n    ", $selectCols) . "
  FROM registrations
  WHERE competition_id = ?
  ORDER BY created_at DESC, id DESC
");
$stmt->execute([$competitionId]);
$rows = $stmt->fetchAll();

// Decode selections and collect option ids for name lookup
$allOptionIds = [];
$decoded = [];

foreach ($rows as $r) {
  $selRaw = $r['event_selections_json'] ?? '';
  $sels = [];

  if (is_string($selRaw) && trim($selRaw) !== '') {
    $tmp = json_decode($selRaw, true);
    if (is_array($tmp)) {
      // Normalize each selection entry to {id, name?, price}
      foreach ($tmp as $item) {
        if (!is_array($item)) continue;

        $id = isset($item['id']) ? (int)$item['id'] : 0;
        $name = isset($item['name']) ? (string)$item['name'] : '';
        $price = isset($item['price']) ? (float)$item['price'] : 0.0;

        if ($id > 0) $allOptionIds[$id] = true;

        $sels[] = [
          'id' => $id,
          'name' => $name,
          'price' => $price,
        ];
      }
    }
  }

  $decoded[] = [
    'id' => (int)$r['id'],
    'competitionId' => (int)$r['competition_id'],
    'firstName' => (string)$r['first_name'],
    'lastName' => (string)$r['last_name'],
    'coachName' => $r['coach_name'] !== null ? (string)$r['coach_name'] : '',
    'teamName' => isset($r['team_name']) && $r['team_name'] !== null ? (string)$r['team_name'] : '',
    'dateOfBirth' => isset($r['date_of_birth']) && $r['date_of_birth'] !== null ? (string)$r['date_of_birth'] : '',
    'gender' => isset($r['gender']) && $r['gender'] !== null ? (string)$r['gender'] : '',
    'email' => isset($r['email']) && $r['email'] !== null ? (string)$r['email'] : '',
    'homePhone' => isset($r['home_phone']) && $r['home_phone'] !== null ? (string)$r['home_phone'] : '',
    'soloStatus' => isset($r['solo_status']) && $r['solo_status'] !== null ? (string)$r['solo_status'] : '',
    'isDuetOrTrio' => isset($r['is_duet_or_trio']) ? (int)$r['is_duet_or_trio'] : 0,
    'ageDivision' => $r['age_division'] !== null ? (string)$r['age_division'] : '',
    'eventSelections' => $sels,
    'eventSubtotal' => (float)$r['event_subtotal'],
    'facilityFee' => (float)$r['facility_fee'],
    'eventTotal' => (float)$r['event_total'],
    'createdAt' => (string)$r['created_at'],
  ];
}

// If selections don’t include names, map ids -> names from event_options
$optionNameById = [];
$ids = array_keys($allOptionIds);
if (count($ids) > 0) {
  $placeholders = implode(',', array_fill(0, count($ids), '?'));
  $stmt = $pdo->prepare("SELECT id, name FROM event_options WHERE id IN ($placeholders)");
  $stmt->execute($ids);
  foreach ($stmt->fetchAll() as $o) {
    $oid = (int)$o['id'];
    $optionNameById[$oid] = (string)$o['name'];
  }
}

// Fill missing names
foreach ($decoded as &$reg) {
  if (!isset($reg['eventSelections']) || !is_array($reg['eventSelections'])) continue;
  foreach ($reg['eventSelections'] as &$sel) {
    if (!is_array($sel)) continue;
    $sid = isset($sel['id']) ? (int)$sel['id'] : 0;
    $sname = isset($sel['name']) ? trim((string)$sel['name']) : '';
    if ($sname === '' && $sid > 0 && isset($optionNameById[$sid])) {
      $sel['name'] = $optionNameById[$sid];
    }
  }
}
unset($reg);

json_response([
  'ok' => true,
  'competitionId' => $competitionId,
  'registrations' => $decoded,
]);
