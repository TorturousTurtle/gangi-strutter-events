<?php
require __DIR__ . '/util.php';
require_once __DIR__ . '/../../server/lib/RateLimiter.php';

allow_cors();

$pdo = require __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Apply rate limiting to POST requests only (10 requests per minute per IP)
if ($method === 'POST') {
  $rateLimiter = new RateLimiter('register', 10, 60);
  if (!$rateLimiter->checkOrFail()) {
    // Response already sent by checkOrFail()
    exit;
  }
}

// GET: return event options for the current competition (used to render the registration form)
if ($method === 'GET') {
  // Load fields configuration
  $fieldsConfigPath = dirname(__DIR__, 2) . '/config/fields.json';
  $fieldsConfig = null;
  if (file_exists($fieldsConfigPath)) {
    $fieldsJson = file_get_contents($fieldsConfigPath);
    $fieldsConfig = json_decode($fieldsJson, true);
  }

  // Find the current competition
  $stmt = $pdo->query("SELECT id, name, facility_fee, registration_config_json, product_enabled, product_name, product_price FROM competitions WHERE is_current = 1 LIMIT 1");
  $comp = $stmt->fetch();

  if (!$comp) {
    json_response([
      'ok' => true,
      'competition' => null,
      'eventOptions' => [],
      'coaches' => [],
      'fieldsConfig' => $fieldsConfig,
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
        'productEnabled' => (int)($comp['product_enabled'] ?? 0),
        'productName' => (string)($comp['product_name'] ?? ''),
        'productPrice' => number_format((float)($comp['product_price'] ?? 0), 2, '.', ''),
      ],
      'eventOptions' => [],
      'coaches' => [],
      'fieldsConfig' => $fieldsConfig,
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
        'productEnabled' => (int)($comp['product_enabled'] ?? 0),
        'productName' => (string)($comp['product_name'] ?? ''),
        'productPrice' => number_format((float)($comp['product_price'] ?? 0), 2, '.', ''),
      ],
      'eventOptions' => [],
      'coaches' => [],
      'fieldsConfig' => $fieldsConfig,
    ]);
    exit;
  }

  // Check if category column exists (migration may not have run yet)
  $hasCategory = false;
  try {
    $chk = $pdo->query("SHOW COLUMNS FROM event_options LIKE 'category'");
    $hasCategory = (bool)$chk->fetch();
  } catch (Throwable $e) {
    $hasCategory = false;
  }

  // Check if event_group column exists
  $hasEventGroup = false;
  try {
    $chk = $pdo->query("SHOW COLUMNS FROM event_options LIKE 'event_group'");
    $hasEventGroup = (bool)$chk->fetch();
  } catch (Throwable $e) {
    $hasEventGroup = false;
  }

  // Fetch names, category, and event_group for those event option IDs
  $placeholders = implode(',', array_fill(0, count($ids), '?'));
  if ($hasCategory && $hasEventGroup) {
    $stmt = $pdo->prepare("SELECT id, name, default_price, category, category_order, event_group FROM event_options WHERE id IN ($placeholders) AND is_active = 1");
  } else if ($hasCategory) {
    $stmt = $pdo->prepare("SELECT id, name, default_price, category, category_order FROM event_options WHERE id IN ($placeholders) AND is_active = 1");
  } else {
    $stmt = $pdo->prepare("SELECT id, name, default_price FROM event_options WHERE id IN ($placeholders) AND is_active = 1");
  }
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
    $category = $hasCategory ? ($r['category'] ?? $byId[$id]['category'] ?? null) : null;
    $categoryOrder = $hasCategory ? (int)($byId[$id]['category_order'] ?? 0) : 0;
    $eventGroup = $hasEventGroup ? ($r['eventGroup'] ?? $byId[$id]['event_group'] ?? null) : null;

    $out[] = [
      'id' => $id,
      'name' => $name,
      'price' => number_format($price, 2, '.', ''),
      'category' => $category,
      'categoryOrder' => $categoryOrder,
      'eventGroup' => $eventGroup,
    ];
  }

  // Load event categories if table exists
  $eventCategories = [];
  try {
    $catStmt = $pdo->query("SELECT id, name, slug, description, display_order FROM event_categories WHERE is_active = 1 ORDER BY display_order ASC");
    $eventCategories = $catStmt->fetchAll();
  } catch (Throwable $e) {
    // Table doesn't exist yet
  }

  // Coaches allowed on registration form for the current competition
  $coaches = [];
  try {
    $stmt = $pdo->prepare(" 
      SELECT c.id, c.name, c.internal_code
      FROM competition_coaches cc
      JOIN coaches c ON c.id = cc.coach_id
      WHERE cc.competition_id = ?
        AND cc.include_on_registration = 1
        AND c.is_active = 1
      ORDER BY COALESCE(cc.sort_order, 999999) ASC, c.name ASC, c.id ASC
    ");
    $stmt->execute([(int)$comp['id']]);
    $coaches = $stmt->fetchAll();
    if (!is_array($coaches)) $coaches = [];
  } catch (Throwable $e) {
    $coaches = [];
  }

  json_response([
    'ok' => true,
    'competition' => [
      'id' => (int)$comp['id'],
      'name' => $comp['name'],
      'facilityFee' => number_format((float)($comp['facility_fee'] ?? 0), 2, '.', ''),
      'productEnabled' => (int)($comp['product_enabled'] ?? 0),
      'productName' => (string)($comp['product_name'] ?? ''),
      'productPrice' => number_format((float)($comp['product_price'] ?? 0), 2, '.', ''),
    ],
    'eventOptions' => $out,
    'eventCategories' => $eventCategories,
    'coaches' => $coaches,
    'fieldsConfig' => $fieldsConfig,
  ]);
  exit;
}

// POST: existing registration submit
require_method('POST');

$stmt = $pdo->query("SELECT id, facility_fee, registration_config_json, product_enabled, product_name, product_price FROM competitions WHERE is_current = 1 LIMIT 1");
$comp = $stmt->fetch();
if (!$comp) {
  json_response(['ok' => false, 'error' => 'No active competition is configured.'], 400);
}

$competitionId = (int)($comp['id'] ?? 0);
$facilityFeeDb = (float)($comp['facility_fee'] ?? 0);
if ($facilityFeeDb < 0) $facilityFeeDb = 0;
// Facility fee can be optionally waived (set in payment.html, passed through thank-you -> register.php)
// Facility fee can be optionally waived (set in payment.html, passed through thank-you -> register.php)
$applyFacilityFee = 1;
if (array_key_exists('applyFacilityFee', $_POST)) {
  $v = $_POST['applyFacilityFee'];

  // Normalize common representations to boolean.
  // IMPORTANT: the string "false" is NOT empty in PHP, so handle explicitly.
  if (is_bool($v)) {
    $applyFacilityFee = $v ? 1 : 0;
  } else {
    $vs = strtolower(trim((string)$v));
    if ($vs === '' || $vs === '1' || $vs === 'true' || $vs === 'yes' || $vs === 'on') {
      $applyFacilityFee = 1;
    } elseif ($vs === '0' || $vs === 'false' || $vs === 'no' || $vs === 'off') {
      $applyFacilityFee = 0;
    } else {
      // Fallback: numeric-ish strings
      $applyFacilityFee = (is_numeric($vs) && (float)$vs > 0) ? 1 : 0;
    }
  }
} elseif (array_key_exists('facilityFeeApplied', $_POST)) {
  // If the client posts an explicit applied fee amount, infer the toggle.
  $ffa = (float)$_POST['facilityFeeApplied'];
  $applyFacilityFee = ($ffa > 0) ? 1 : 0;
}

$facilityFeeApplied = $applyFacilityFee ? $facilityFeeDb : 0.0;

// Optional add-on product (server-side truth comes from competitions table)
$productEnabledDb = !empty($comp['product_enabled']) ? 1 : 0;
$productNameDb = trim((string)($comp['product_name'] ?? ''));
$productPriceDb = (float)($comp['product_price'] ?? 0);
if ($productPriceDb < 0) $productPriceDb = 0;

// Client selection (do not trust client price/name)
$optionalProductSelected = 0;
if (array_key_exists('optionalProductSelected', $_POST)) {
  $v = $_POST['optionalProductSelected'];
  if (is_bool($v)) {
    $optionalProductSelected = $v ? 1 : 0;
  } else {
    $vs = strtolower(trim((string)$v));
    $optionalProductSelected = ($vs === '1' || $vs === 'true' || $vs === 'yes' || $vs === 'on') ? 1 : 0;
  }
} elseif (array_key_exists('optional_product_selected', $_POST)) {
  // Back-compat if any client sends snake_case
  $v = $_POST['optional_product_selected'];
  $vs = strtolower(trim((string)$v));
  $optionalProductSelected = ($vs === '1' || $vs === 'true' || $vs === 'yes' || $vs === 'on') ? 1 : 0;
}

// Apply only if enabled and valid in DB
if (!($productEnabledDb === 1 && $productNameDb !== '' && $productPriceDb > 0)) {
  $optionalProductSelected = 0;
}

$optionalProductName = $optionalProductSelected ? $productNameDb : '';
$optionalProductPrice = $optionalProductSelected ? $productPriceDb : 0.0;

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

// Build allowed coach IDs for this competition (include_on_registration = 1)
$allowedCoachById = [];
try {
  $stmt = $pdo->prepare(" 
    SELECT c.id, c.name, c.internal_code
    FROM competition_coaches cc
    JOIN coaches c ON c.id = cc.coach_id
    WHERE cc.competition_id = ?
      AND cc.include_on_registration = 1
      AND c.is_active = 1
  ");
  $stmt->execute([$competitionId]);
  $rows = $stmt->fetchAll();
  if (is_array($rows)) {
    foreach ($rows as $r) {
      $id = (int)($r['id'] ?? 0);
      if ($id > 0) $allowedCoachById[$id] = $r;
    }
  }
} catch (Throwable $e) {
  $allowedCoachById = [];
}

// Optional free-text coach ("Other")
$coachOtherName = isset($_POST['coachOtherName']) ? trim((string)$_POST['coachOtherName']) : '';
if (mb_strlen($coachOtherName) > 100) {
  $coachOtherName = mb_substr($coachOtherName, 0, 100);
}

// Pull fields safely
$data = [
  'first_name' => isset($_POST['firstName']) ? trim((string)$_POST['firstName']) : null,
  'last_name'  => isset($_POST['lastName'])  ? trim((string)$_POST['lastName'])  : null,
  'date_of_birth' => $_POST['dateOfBirth'] ?? null,
  'gender' => $_POST['gender'] ?? null,
  'age_division' => $_POST['ageDivision'] ?? null,
  'competition_id' => $competitionId,
  // Back-compat: old `coachName` (single text). New UI sends `coachNames` + `coachSelections`.
  'coach_name' => isset($_POST['coachNames'])
    ? trim((string)$_POST['coachNames'])
    : (isset($_POST['coachName']) ? trim((string)$_POST['coachName']) : null),
  'coach_selections_json' => null,
  'team_name' => isset($_POST['teamName']) ? trim((string)$_POST['teamName']) : null,
  'email'      => isset($_POST['email'])     ? trim((string)$_POST['email'])     : null,
  'home_phone' => $_POST['homePhone'] ?? null,
  'solo_status' => $_POST['soloStatus'] ?? null,
  'is_duet_or_trio' => (($_POST['isDuetOrTrio'] ?? 'no') === 'yes') ? 1 : 0,
  'event_selections_json' => null,
  'event_subtotal' => 0.00,
  'facility_fee' => number_format($facilityFeeApplied, 2, '.', ''),
  'optional_product_selected' => $optionalProductSelected,
  'optional_product_name' => $optionalProductName !== '' ? $optionalProductName : null,
  'optional_product_price' => number_format((float)$optionalProductPrice, 2, '.', ''),
  'event_total' => 0.00,
  'created_at' => date('Y-m-d H:i:s'),
];

// Normalize team_name: optional field. Prefer NULL for blank values.
if (array_key_exists('team_name', $data)) {
  if ($data['team_name'] !== null) {
    $data['team_name'] = trim((string)$data['team_name']);
    if ($data['team_name'] === '') $data['team_name'] = null;
  }
}

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

// Parse selected coaches (JSON array of {id, name, internal_code} coming from the client)
$rawCoachSelections = isset($_POST['coachSelections']) ? (string)$_POST['coachSelections'] : '';
$decodedCoaches = $rawCoachSelections !== '' ? json_decode($rawCoachSelections, true) : [];
if ($rawCoachSelections !== '' && !is_array($decodedCoaches)) {
  json_response(['ok' => false, 'error' => 'Invalid coach selections.'], 400);
}

$cleanCoachSelections = [];
$coachNamesOut = [];

if (is_array($decodedCoaches)) {
  foreach ($decodedCoaches as $item) {
    if (!is_array($item)) continue;
    $id = isset($item['id']) ? (int)$item['id'] : 0;

    // Special case: free-text "Other" coach (id=0)
    if ($id === 0) {
      if ($coachOtherName !== '') {
        $cleanCoachSelections[] = [
          'id' => 0,
          'name' => $coachOtherName,
          'internal_code' => 'OTHER',
        ];
        $coachNamesOut[] = $coachOtherName;
      }
      continue;
    }

    if ($id < 0) continue;

    // Only allow coaches configured for this competition
    if (!isset($allowedCoachById[$id])) continue;

    $row = $allowedCoachById[$id];
    $nm = (string)($row['name'] ?? '');
    $cd = (string)($row['internal_code'] ?? '');

    $cleanCoachSelections[] = [
      'id' => $id,
      'name' => $nm,
      'internal_code' => $cd,
    ];

    if ($nm !== '') $coachNamesOut[] = $nm;
  }
}
// Defensive: if user provided coachOtherName but the client didn't include the id=0 entry
if ($coachOtherName !== '') {
  $already = false;
  foreach ($cleanCoachSelections as $cs) {
    if (is_array($cs) && (int)($cs['id'] ?? -1) === 0) { $already = true; break; }
  }
  if (!$already) {
    $cleanCoachSelections[] = [
      'id' => 0,
      'name' => $coachOtherName,
      'internal_code' => 'OTHER',
    ];
    $coachNamesOut[] = $coachOtherName;
  }
}

// Persist coach selections JSON and normalize coach_name to the validated list when provided
$data['coach_selections_json'] = count($cleanCoachSelections) ? json_encode($cleanCoachSelections) : null;
if (count($coachNamesOut)) {
  $data['coach_name'] = implode(', ', $coachNamesOut);
}

// Persist selections JSON + totals
$data['event_selections_json'] = count($cleanSelections) ? json_encode($cleanSelections) : null;
$data['event_subtotal'] = number_format($subtotal, 2, '.', '');
$data['event_total'] = number_format($subtotal + $facilityFeeApplied + $optionalProductPrice, 2, '.', '');

// Insert (conditionally includes team_name if the column exists)
$hasTeam = false;
$teamAllowsNull = true; // assume nullable unless proven otherwise
try {
  $chk = $pdo->query("SHOW COLUMNS FROM registrations LIKE 'team_name'");
  $col = $chk->fetch();
  $hasTeam = (bool)$col;
  if ($hasTeam && is_array($col)) {
    // SHOW COLUMNS returns 'Null' => 'YES'|'NO'
    $teamAllowsNull = (strtoupper((string)($col['Null'] ?? 'YES')) === 'YES');
  }
} catch (Throwable $e) {
  $hasTeam = false;
  $teamAllowsNull = true;
}

$hasCoachSelections = false;
try {
  $chk = $pdo->query("SHOW COLUMNS FROM registrations LIKE 'coach_selections_json'");
  $hasCoachSelections = (bool)$chk->fetch();
} catch (Throwable $e) {
  $hasCoachSelections = false;
}

$hasOptionalProduct = false;
$optNameAllowsNull = true; // assume nullable unless proven otherwise
try {
  $chk = $pdo->query("SHOW COLUMNS FROM registrations LIKE 'optional_product_selected'");
  $hasOptionalProduct = (bool)$chk->fetch();

  // If optional_product_name exists, detect NULLability
  $chk2 = $pdo->query("SHOW COLUMNS FROM registrations LIKE 'optional_product_name'");
  $col2 = $chk2->fetch();
  if ($col2 && is_array($col2)) {
    $optNameAllowsNull = (strtoupper((string)($col2['Null'] ?? 'YES')) === 'YES');
  }
} catch (Throwable $e) {
  $hasOptionalProduct = false;
  $optNameAllowsNull = true;
}

// Check for custom_data_json column (stores custom/optional fields)
$hasCustomData = false;
try {
  $chk = $pdo->query("SHOW COLUMNS FROM registrations LIKE 'custom_data_json'");
  $hasCustomData = (bool)$chk->fetch();
} catch (Throwable $e) {
  $hasCustomData = false;
}

// Load fields config to identify custom fields
$fieldsConfigPath = dirname(__DIR__, 2) . '/config/fields.json';
$customFieldIds = [];
if (file_exists($fieldsConfigPath)) {
  $fieldsJson = file_get_contents($fieldsConfigPath);
  $fieldsConfig = json_decode($fieldsJson, true);
  if (is_array($fieldsConfig) && isset($fieldsConfig['fields'])) {
    foreach ($fieldsConfig['fields'] as $field) {
      if (isset($field['id']) && isset($field['storage']) && $field['storage'] === 'custom') {
        $customFieldIds[] = $field['id'];
      }
    }
  }
}

// Collect custom field values from POST
$customData = [];
foreach ($customFieldIds as $fieldId) {
  // Check both snake_case and camelCase versions
  $snakeKey = $fieldId;
  $camelKey = lcfirst(str_replace('_', '', ucwords($fieldId, '_')));

  $value = null;
  if (isset($_POST[$snakeKey])) {
    $value = trim((string)$_POST[$snakeKey]);
  } elseif (isset($_POST[$camelKey])) {
    $value = trim((string)$_POST[$camelKey]);
  }

  if ($value !== null && $value !== '') {
    $customData[$fieldId] = $value;
  }
}

// Store custom data as JSON
$data['custom_data_json'] = count($customData) > 0 ? json_encode($customData) : null;

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
  // If the DB column is NOT NULL, store empty string instead of NULL
  // so team name remains optional without breaking inserts.
  if (!$teamAllowsNull && ($data['team_name'] === null)) {
    $data['team_name'] = '';
  }

  $columns[] = 'team_name';
  $placeholders[] = ':team_name';
} else {
  // Avoid “parameter not used” warnings if the DB hasn’t been migrated yet
  unset($data['team_name']);
}

if ($hasCoachSelections) {
  $columns[] = 'coach_selections_json';
  $placeholders[] = ':coach_selections_json';
} else {
  unset($data['coach_selections_json']);
}

if ($hasOptionalProduct) {
  $columns[] = 'optional_product_selected';
  $placeholders[] = ':optional_product_selected';

  $columns[] = 'optional_product_name';
  $placeholders[] = ':optional_product_name';

  $columns[] = 'optional_product_price';
  $placeholders[] = ':optional_product_price';

  // If the DB column is NOT NULL, store empty string instead of NULL
  if (!$optNameAllowsNull && ($data['optional_product_name'] === null)) {
    $data['optional_product_name'] = '';
  }
} else {
  // Avoid parameter not used warnings if the DB hasn't been migrated yet
  unset($data['optional_product_selected']);
  unset($data['optional_product_name']);
  unset($data['optional_product_price']);
}

if ($hasCustomData) {
  $columns[] = 'custom_data_json';
  $placeholders[] = ':custom_data_json';
} else {
  unset($data['custom_data_json']);
}

// Check for payment tracking columns (from migration 005)
$hasPaymentStatus = false;
try {
  $chk = $pdo->query("SHOW COLUMNS FROM registrations LIKE 'payment_status'");
  $hasPaymentStatus = (bool)$chk->fetch();
} catch (Throwable $e) {
  $hasPaymentStatus = false;
}

if ($hasPaymentStatus) {
  // Get payment info from POST if available (passed from payment page)
  $paymentStatus = isset($_POST['paymentStatus']) ? trim((string)$_POST['paymentStatus']) : 'pending';
  $paymentProvider = isset($_POST['paymentProvider']) ? trim((string)$_POST['paymentProvider']) : null;
  $paymentTransactionId = isset($_POST['paymentTransactionId']) ? (int)$_POST['paymentTransactionId'] : null;

  // Validate payment status
  $validStatuses = ['pending', 'completed', 'pending_manual', 'failed'];
  if (!in_array($paymentStatus, $validStatuses, true)) {
    $paymentStatus = 'pending';
  }

  $data['payment_status'] = $paymentStatus;
  $data['payment_provider'] = $paymentProvider ?: null;
  $data['payment_transaction_id'] = $paymentTransactionId ?: null;

  $columns[] = 'payment_status';
  $placeholders[] = ':payment_status';
  $columns[] = 'payment_provider';
  $placeholders[] = ':payment_provider';
  $columns[] = 'payment_transaction_id';
  $placeholders[] = ':payment_transaction_id';
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
