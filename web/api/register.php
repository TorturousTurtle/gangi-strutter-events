<?php
require __DIR__ . '/util.php';

allow_cors();

$pdo = require __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// GET: return event options for the current competition (used to render the registration form)
if ($method === 'GET') {
  // Find the current competition
  $stmt = $pdo->query("SELECT id, name, facility_fee, registration_config_json FROM competitions WHERE is_current = 1 LIMIT 1");
  $comp = $stmt->fetch();

  if (!$comp) {
    json_response([
      'ok' => true,
      'competition' => null,
      'eventOptions' => [],
    ]);
    exit;
  }

  $cfg = $comp['registration_config_json'] ? json_decode($comp['registration_config_json'], true) : [];
  if (!is_array($cfg)) $cfg = [];

  // Keep only included rows (these are the events associated with the contest)
  $cfg = array_values(array_filter($cfg, function($r) {
    return is_array($r) && !empty($r['included']) && !empty($r['optionId']);
  }));

  // No configured options
  if (count($cfg) === 0) {
    json_response([
      'ok' => true,
      'competition' => [
        'id' => (int)$comp['id'],
        'name' => $comp['name'],
        'facilityFee' => number_format((float)($comp['facility_fee'] ?? 0), 2, '.', ''),
      ],
      'eventOptions' => [],
    ]);
    exit;
  }

  // Build an ordered list of IDs from config
  $ids = array_map(function($r) { return (int)$r['optionId']; }, $cfg);
  $ids = array_values(array_filter($ids, function($id) { return $id > 0; }));

  if (count($ids) === 0) {
    json_response([
      'ok' => true,
      'competition' => [
        'id' => (int)$comp['id'],
        'name' => $comp['name'],
        'facilityFee' => number_format((float)($comp['facility_fee'] ?? 0), 2, '.', ''),
      ],
      'eventOptions' => [],
    ]);
    exit;
  }

  // Fetch names for those event option IDs
  $placeholders = implode(',', array_fill(0, count($ids), '?'));
  $stmt = $pdo->prepare("SELECT id, name, default_price FROM event_options WHERE id IN ($placeholders) AND is_active = 1");
  $stmt->execute($ids);
  $rows = $stmt->fetchAll();

  // Index by id
  $byId = [];
  foreach ($rows as $r) {
    $byId[(int)$r['id']] = $r;
  }

  // Produce ordered output based on config order (price can be overridden per competition)
  $out = [];
  foreach ($cfg as $r) {
    $id = (int)$r['optionId'];
    if ($id <= 0) continue;
    if (!isset($byId[$id])) continue;

    $name = $byId[$id]['name'];
    $price = isset($r['price']) ? (float)$r['price'] : (float)$byId[$id]['default_price'];

    $out[] = [
      'id' => $id,
      'name' => $name,
      'price' => number_format($price, 2, '.', ''),
    ];
  }

  json_response([
    'ok' => true,
    'competition' => [
      'id' => (int)$comp['id'],
      'name' => $comp['name'],
      'facilityFee' => number_format((float)($comp['facility_fee'] ?? 0), 2, '.', ''),
    ],
    'eventOptions' => $out,
  ]);
  exit;
}

// POST: existing registration submit
require_method('POST');

// Load current competition for pricing + facility fee
$stmt = $pdo->query("SELECT id, facility_fee, registration_config_json FROM competitions WHERE is_current = 1 LIMIT 1");
$comp = $stmt->fetch();
if (!$comp) {
  json_response(['ok' => false, 'error' => 'No active competition is configured.'], 400);
}

$competitionId = (int)($comp['id'] ?? 0);
$facilityFeeDb = (float)($comp['facility_fee'] ?? 0);
if ($facilityFeeDb < 0) $facilityFeeDb = 0;

// Build allowed event option IDs and their price (from registration_config_json)
$cfg = $comp['registration_config_json'] ? json_decode($comp['registration_config_json'], true) : [];
if (!is_array($cfg)) $cfg = [];

$allowedPriceById = [];
foreach ($cfg as $row) {
  if (!is_array($row)) continue;
  if (empty($row['included'])) continue;
  $oid = isset($row['optionId']) ? (int)$row['optionId'] : 0;
  if ($oid <= 0) continue;
  $p = isset($row['price']) ? (float)$row['price'] : 0;
  if ($p < 0) $p = 0;
  $allowedPriceById[$oid] = $p;
}

// Pull fields safely
$data = [
  'first_name' => isset($_POST['firstName']) ? trim((string)$_POST['firstName']) : null,
  'last_name'  => isset($_POST['lastName'])  ? trim((string)$_POST['lastName'])  : null,
  'date_of_birth' => $_POST['dateOfBirth'] ?? null,
  'gender' => $_POST['gender'] ?? null,
  'age_division' => $_POST['ageDivision'] ?? null,
  'competition_id' => $competitionId,
  'coach_name' => isset($_POST['coachName']) ? trim((string)$_POST['coachName']) : null,
  'team_name' => isset($_POST['teamName']) ? trim((string)$_POST['teamName']) : null,
  'email'      => isset($_POST['email'])     ? trim((string)$_POST['email'])     : null,
  'home_phone' => $_POST['homePhone'] ?? null,
  'solo_status' => $_POST['soloStatus'] ?? null,
  'is_duet_or_trio' => (($_POST['isDuetOrTrio'] ?? 'no') === 'yes') ? 1 : 0,
  'event_selections_json' => null,
  'event_subtotal' => 0.00,
  'facility_fee' => number_format($facilityFeeDb, 2, '.', ''),
  'event_total' => 0.00,
  'created_at' => date('Y-m-d H:i:s'),
];

// Validation
if (!$data['first_name'] || !$data['last_name'] || !$data['email']) {
  json_response(['ok' => false, 'error' => 'First name, last name, and email are required.'], 400);
}

if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
  json_response(['ok' => false, 'error' => 'Please enter a valid email address.'], 400);
}

// Parse selected event options (JSON array of {id, price} coming from the client)
$rawSelections = isset($_POST['eventSelections']) ? (string)$_POST['eventSelections'] : '';
$decoded = $rawSelections !== '' ? json_decode($rawSelections, true) : [];
if ($rawSelections !== '' && !is_array($decoded)) {
  json_response(['ok' => false, 'error' => 'Invalid event selections.'], 400);
}

$cleanSelections = [];
$subtotal = 0.0;

if (is_array($decoded)) {
  foreach ($decoded as $item) {
    if (!is_array($item)) continue;
    $id = isset($item['id']) ? (int)$item['id'] : 0;
    if ($id <= 0) continue;

    // Only allow events that are included for the current competition
    if (!array_key_exists($id, $allowedPriceById)) continue;

    // Use the server-side price (do not trust the client)
    $price = (float)$allowedPriceById[$id];
    if ($price < 0) $price = 0;

    $cleanSelections[] = ['id' => $id, 'price' => number_format($price, 2, '.', '')];
    $subtotal += $price;
  }
}

// Persist selections JSON + totals
$data['event_selections_json'] = count($cleanSelections) ? json_encode($cleanSelections) : null;
$data['event_subtotal'] = number_format($subtotal, 2, '.', '');
$data['event_total'] = number_format($subtotal + $facilityFeeDb, 2, '.', '');

// Insert (conditionally includes team_name if the column exists)
$hasTeam = false;
try {
  $chk = $pdo->query("SHOW COLUMNS FROM registrations LIKE 'team_name'");
  $hasTeam = (bool)$chk->fetch();
} catch (Throwable $e) {
  $hasTeam = false;
}

$columns = [
  'competition_id',
  'first_name',
  'last_name',
  'coach_name',
];
$placeholders = [
  ':competition_id',
  ':first_name',
  ':last_name',
  ':coach_name',
];

if ($hasTeam) {
  $columns[] = 'team_name';
  $placeholders[] = ':team_name';
} else {
  // Avoid “parameter not used” warnings if the DB hasn’t been migrated yet
  unset($data['team_name']);
}

$columns = array_merge($columns, [
  'date_of_birth',
  'gender',
  'age_division',
  'email',
  'home_phone',
  'solo_status',
  'is_duet_or_trio',
  'event_selections_json',
  'event_subtotal',
  'facility_fee',
  'event_total',
  'created_at',
]);

$placeholders = array_merge($placeholders, [
  ':date_of_birth',
  ':gender',
  ':age_division',
  ':email',
  ':home_phone',
  ':solo_status',
  ':is_duet_or_trio',
  ':event_selections_json',
  ':event_subtotal',
  ':facility_fee',
  ':event_total',
  ':created_at',
]);

$sql = "INSERT INTO registrations (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $placeholders) . ")";

try {
  $stmt = $pdo->prepare($sql);
  $stmt->execute($data);

  json_response([
    'ok' => true,
    'id' => (int)$pdo->lastInsertId(),
  ]);
} catch (Throwable $e) {
  // Don't leak internal details to the client.
  json_response(['ok' => false, 'error' => 'Failed to save registration. Please try again.'], 500);
}
