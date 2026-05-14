<?php
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

$id = isset($payload['id']) ? (int)$payload['id'] : 0;
$updates = $payload['updates'] ?? null;

if ($id <= 0 || !is_array($updates)) {
  json_response(['ok' => false, 'error' => 'Missing or invalid id/updates.'], 400);
}

// Load existing row (also gives us competition_id if needed later)
$stmt = $pdo->prepare("SELECT * FROM registrations WHERE id = ? LIMIT 1");
$stmt->execute([$id]);
$existing = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$existing) {
  json_response(['ok' => false, 'error' => 'Registration not found.'], 404);
}

// Whitelist fields we allow editing from the admin UI
$allowed = [
  'first_name',
  'last_name',
  'email',
  'home_phone',
  'team_name',
  'coach_name',
  'date_of_birth',
  'gender',
  'age_division',
  'solo_status',
  'is_duet_or_trio',

  // JSON fields (stored as TEXT)
  'event_selections_json',
  'coach_selections_json',

  // Money-ish fields
  'event_subtotal',
  'facility_fee',

  // Optional product (t-shirt)
  'optional_product_selected',
  'optional_product_name',
  'optional_product_price',
];

// Normalize + collect set clauses
$set = [];
$params = [];

// Helper normalizers
$as_string = function($v) {
  if ($v === null) return null;
  return trim((string)$v);
};
$as_bool01 = function($v) {
  if ($v === true || $v === 1) return 1;
  $s = strtolower(trim((string)$v));
  return ($s === '1' || $s === 'true' || $s === 'yes' || $s === 'on') ? 1 : 0;
};
$as_money = function($v) {
  if ($v === null || $v === '') return 0.00;
  if (!is_numeric($v)) return 0.00;
  $f = (float)$v;
  if ($f < 0) $f = 0;
  return (float)number_format($f, 2, '.', '');
};

// Apply allowed updates
foreach ($allowed as $col) {
  if (!array_key_exists($col, $updates)) continue;

  $val = $updates[$col];

  if ($col === 'is_duet_or_trio' || $col === 'optional_product_selected') {
    $val = $as_bool01($val);
  } elseif ($col === 'event_subtotal' || $col === 'facility_fee' || $col === 'optional_product_price') {
    $val = $as_money($val);
  } elseif ($col === 'event_selections_json' || $col === 'coach_selections_json') {
    // accept either already-stringified JSON or array/object; store as JSON string or NULL
    if (is_array($val) || is_object($val)) {
      $val = json_encode($val);
    } else {
      $val = $as_string($val);
    }
    if ($val === '') $val = null;
  } else {
    $val = $as_string($val);
    if ($val === '') $val = null;
  }

  $set[] = "{$col} = ?";
  $params[] = $val;
}

// If nothing to update, still return current row
if (count($set) === 0) {
  json_response(['ok' => true, 'registration' => $existing]);
}

// Force total recompute server-side
// event_total = event_subtotal + facility_fee + (optional_product_price if selected)
$eventSubtotal = array_key_exists('event_subtotal', $updates)
  ? $as_money($updates['event_subtotal'])
  : $as_money($existing['event_subtotal'] ?? 0);

$facilityFee = array_key_exists('facility_fee', $updates)
  ? $as_money($updates['facility_fee'])
  : $as_money($existing['facility_fee'] ?? 0);

$optSelected = array_key_exists('optional_product_selected', $updates)
  ? $as_bool01($updates['optional_product_selected'])
  : $as_bool01($existing['optional_product_selected'] ?? 0);

$optPrice = array_key_exists('optional_product_price', $updates)
  ? $as_money($updates['optional_product_price'])
  : $as_money($existing['optional_product_price'] ?? 0);

$optName = array_key_exists('optional_product_name', $updates)
  ? $as_string($updates['optional_product_name'])
  : $as_string($existing['optional_product_name'] ?? null);

// If not selected, wipe name/price
if ($optSelected !== 1) {
  $optPrice = 0.00;
  $optName = null;

  // Ensure DB gets wiped even if admin edited name/price
  $set[] = "optional_product_name = ?";
  $params[] = $optName;

  $set[] = "optional_product_price = ?";
  $params[] = $optPrice;
}

$eventTotal = (float)number_format($eventSubtotal + $facilityFee + ($optSelected ? $optPrice : 0.00), 2, '.', '');
$set[] = "event_total = ?";
$params[] = $eventTotal;

// Always bump updated_at if column exists (optional)
try {
  $chk = $pdo->query("SHOW COLUMNS FROM registrations LIKE 'updated_at'");
  if ($chk && $chk->fetch()) {
    $set[] = "updated_at = ?";
    $params[] = date('Y-m-d H:i:s');
  }
} catch (Throwable $e) {
  // ignore
}

$params[] = $id;

$sql = "UPDATE registrations SET " . implode(", ", $set) . " WHERE id = ?";

try {
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);

  $stmt = $pdo->prepare("SELECT * FROM registrations WHERE id = ? LIMIT 1");
  $stmt->execute([$id]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);

  json_response(['ok' => true, 'registration' => $row]);
} catch (Throwable $e) {
  json_response(['ok' => false, 'error' => 'Failed to update registration.'], 500);
}
