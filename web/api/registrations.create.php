<?php
// web/api/registrations.create.php
// Admin: create a new registration row

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/admin_auth.php';
require_admin_auth();

allow_cors();
require_method('POST');

$pdo = require __DIR__ . '/db.php';

$raw = file_get_contents('php://input');
$payload = $raw ? json_decode($raw, true) : null;
if (!is_array($payload)) {
  json_response(['ok' => false, 'error' => 'Invalid JSON body.'], 400);
}

$competitionId = isset($payload['competition_id']) ? (int)$payload['competition_id'] : 0;

// Default to current competition if not provided
if ($competitionId <= 0) {
  $stmt = $pdo->query("SELECT id FROM competitions WHERE is_current = 1 ORDER BY id DESC LIMIT 1");
  $row = $stmt->fetch();
  $competitionId = $row ? (int)$row['id'] : 0;
}
if ($competitionId <= 0) {
  json_response(['ok' => false, 'error' => 'No active competition.'], 400);
}

// Minimal required fields
$first = trim((string)($payload['first_name'] ?? ''));
$last  = trim((string)($payload['last_name'] ?? ''));
$email = trim((string)($payload['email'] ?? ''));

if ($first === '' || $last === '' || $email === '') {
  json_response(['ok' => false, 'error' => 'first_name, last_name, and email are required.'], 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  json_response(['ok' => false, 'error' => 'Invalid email.'], 400);
}

// Optional fields
$homePhone = isset($payload['home_phone']) ? (string)$payload['home_phone'] : null;
$teamName  = isset($payload['team_name']) ? trim((string)$payload['team_name']) : null;
if ($teamName !== null && $teamName === '') $teamName = null;

$dateOfBirth = isset($payload['date_of_birth']) ? (string)$payload['date_of_birth'] : null;
$gender      = isset($payload['gender']) ? (string)$payload['gender'] : null;
$ageDiv      = isset($payload['age_division']) ? (string)$payload['age_division'] : null;
$soloStatus  = isset($payload['solo_status']) ? (string)$payload['solo_status'] : null;

$isDuetOrTrio = 0;
if (array_key_exists('is_duet_or_trio', $payload)) {
  $v = $payload['is_duet_or_trio'];
  $isDuetOrTrio = ($v === true || $v === 1 || (is_string($v) && trim($v) === '1')) ? 1 : 0;
}

// JSON fields (store as JSON string or NULL)
$eventSelectionsJson = $payload['event_selections_json'] ?? null;
if (is_array($eventSelectionsJson)) $eventSelectionsJson = json_encode($eventSelectionsJson);
$eventSelectionsJson = is_string($eventSelectionsJson) ? trim($eventSelectionsJson) : null;
if ($eventSelectionsJson === '') $eventSelectionsJson = null;

$coachSelectionsJson = $payload['coach_selections_json'] ?? null;
if (is_array($coachSelectionsJson)) $coachSelectionsJson = json_encode($coachSelectionsJson);
$coachSelectionsJson = is_string($coachSelectionsJson) ? trim($coachSelectionsJson) : null;
if ($coachSelectionsJson === '') $coachSelectionsJson = null;

// Totals (admin can set them; we still keep them consistent)
$eventSubtotal = isset($payload['event_subtotal']) ? (float)$payload['event_subtotal'] : 0.0;
$facilityFee   = isset($payload['facility_fee']) ? (float)$payload['facility_fee'] : 0.0;

$optSelected = 0;
if (array_key_exists('optional_product_selected', $payload)) {
  $v = $payload['optional_product_selected'];
  $optSelected = ($v === true || $v === 1 || (is_string($v) && trim($v) === '1')) ? 1 : 0;
}
$optName  = isset($payload['optional_product_name']) ? trim((string)$payload['optional_product_name']) : null;
$optPrice = isset($payload['optional_product_price']) ? (float)$payload['optional_product_price'] : 0.0;

if ($optSelected !== 1) {
  $optName = null;
  $optPrice = 0.0;
}

$eventTotal = $eventSubtotal + $facilityFee + $optPrice;

$createdAt = date('Y-m-d H:i:s');

// Detect optional columns (migration-safe)
function has_col($pdo, $col) {
  try {
    $chk = $pdo->query("SHOW COLUMNS FROM registrations LIKE '" . $col . "'");
    return (bool)$chk->fetch();
  } catch (Throwable $e) {
    return false;
  }
}

$hasTeam = has_col($pdo, 'team_name');
$hasCoachSelections = has_col($pdo, 'coach_selections_json');
$hasOptionalProduct = has_col($pdo, 'optional_product_selected');

// Build insert
$cols = [
  'competition_id',
  'first_name',
  'last_name',
  'coach_name', // keep for backwards compatibility; we'll derive from coach_selections_json later if you want
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
];

$data = [
  ':competition_id' => $competitionId,
  ':first_name' => $first,
  ':last_name' => $last,
  ':coach_name' => null,
  ':date_of_birth' => $dateOfBirth,
  ':gender' => $gender,
  ':age_division' => $ageDiv,
  ':email' => $email,
  ':home_phone' => $homePhone,
  ':solo_status' => $soloStatus,
  ':is_duet_or_trio' => $isDuetOrTrio,
  ':event_selections_json' => $eventSelectionsJson,
  ':event_subtotal' => number_format($eventSubtotal, 2, '.', ''),
  ':facility_fee' => number_format($facilityFee, 2, '.', ''),
  ':event_total' => number_format($eventTotal, 2, '.', ''),
  ':created_at' => $createdAt,
];

if ($hasTeam) {
  $cols[] = 'team_name';
  $data[':team_name'] = $teamName;
}
if ($hasCoachSelections) {
  $cols[] = 'coach_selections_json';
  $data[':coach_selections_json'] = $coachSelectionsJson;
}
if ($hasOptionalProduct) {
  $cols[] = 'optional_product_selected';
  $cols[] = 'optional_product_name';
  $cols[] = 'optional_product_price';
  $data[':optional_product_selected'] = $optSelected;
  $data[':optional_product_name'] = $optName;
  $data[':optional_product_price'] = number_format($optPrice, 2, '.', '');
}

$placeholders = array_map(fn($c) => ':' . $c, $cols);
$sql = "INSERT INTO registrations (" . implode(', ', $cols) . ") VALUES (" . implode(', ', $placeholders) . ")";

try {
  $stmt = $pdo->prepare($sql);
  $stmt->execute($data);
  $id = (int)$pdo->lastInsertId();

  // Return the created row (snake_case; your JS normalizer already handles this)
  $stmt = $pdo->prepare("SELECT * FROM registrations WHERE id = ? LIMIT 1");
  $stmt->execute([$id]);
  $row = $stmt->fetch();

  json_response(['ok' => true, 'registration' => $row]);
} catch (Throwable $e) {
  json_response(['ok' => false, 'error' => 'Failed to create registration.'], 500);
}
