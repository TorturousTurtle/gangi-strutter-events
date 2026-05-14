<?php
// web/api/admin-list.php
// Admin: list registrants for a competition (defaults to current competition)
// Supports pagination via ?page=1&per_page=50 parameters

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/admin_auth.php';
require_once __DIR__ . '/../../server/lib/SchemaCache.php';

require_admin_auth();

allow_cors();
require_method('GET');

$pdo = require __DIR__ . '/db.php';

// Set PDO for SchemaCache
SchemaCache::setPdo($pdo);

// Pagination parameters
$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
$perPage = isset($_GET['per_page']) ? (int)$_GET['per_page'] : 50;
// Clamp per_page between 1 and 100
$perPage = max(1, min(100, $perPage));
$offset = ($page - 1) * $perPage;

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
    'pagination' => [
      'total' => 0,
      'page' => $page,
      'perPage' => $perPage,
      'totalPages' => 0,
      'hasMore' => false,
    ],
  ]);
}

// Warm the schema cache for registrations table (single query instead of 12+)
SchemaCache::warmCache('registrations');

// Detect optional columns using cached schema (no DB queries here)
$optionalCols = [
  'team_name',
  'date_of_birth',
  'gender',
  'email',
  'home_phone',
  'solo_status',
  'is_duet_or_trio',
  'coach_selections_json',
  'optional_product_selected',
  'optional_product_name',
  'optional_product_price',
  'payment_status',
  'payment_provider',
  'payment_transaction_id',
];

$hasCol = SchemaCache::hasColumns('registrations', $optionalCols);

// Build select columns list - always include these core columns
$selectCols = [
  'id',
  'competition_id',
  'first_name',
  'last_name',
  'coach_name',
];

// Add optional columns if present
foreach ($optionalCols as $c) {
  if (!empty($hasCol[$c])) {
    $selectCols[] = $c;
  }
}

// Always add these columns (they're part of the original schema)
$selectCols = array_merge($selectCols, [
  'age_division',
  'event_selections_json',
  'event_subtotal',
  'facility_fee',
  'event_total',
  'created_at',
]);

// Get total count for pagination
$countStmt = $pdo->prepare("SELECT COUNT(*) FROM registrations WHERE competition_id = ?");
$countStmt->execute([$competitionId]);
$total = (int)$countStmt->fetchColumn();
$totalPages = (int)ceil($total / $perPage);

// Pull registrations with pagination
// Note: LIMIT and OFFSET must be bound as integers, not strings
$stmt = $pdo->prepare("
  SELECT
    " . implode(",\n    ", $selectCols) . "
  FROM registrations
  WHERE competition_id = ?
  ORDER BY created_at DESC, id DESC
  LIMIT " . (int)$perPage . " OFFSET " . (int)$offset . "
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

  $coachSelRaw = $r['coach_selections_json'] ?? '';
  $coachSels = [];

  if (is_string($coachSelRaw) && trim($coachSelRaw) !== '') {
    $tmpc = json_decode($coachSelRaw, true);
    if (is_array($tmpc)) {
      foreach ($tmpc as $item) {
        if (!is_array($item)) continue;

        $cid = array_key_exists('id', $item) ? $item['id'] : null;
        // Normalize to int when numeric, otherwise null
        $cidNorm = null;
        if ($cid !== null && $cid !== '') {
          $cidNorm = is_numeric($cid) ? (int)$cid : null;
        }

        $cname = isset($item['name']) ? (string)$item['name'] : '';
        $ccode = isset($item['internal_code']) ? (string)$item['internal_code'] : '';

        $coachSels[] = [
          'id' => $cidNorm,
          'name' => $cname,
          'internal_code' => $ccode,
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
    'coachSelections' => $coachSels,
    'coachSelectionsJson' => isset($r['coach_selections_json']) && $r['coach_selections_json'] !== null ? (string)$r['coach_selections_json'] : '[]',
    'teamName' => isset($r['team_name']) && $r['team_name'] !== null ? (string)$r['team_name'] : '',
    'dateOfBirth' => isset($r['date_of_birth']) && $r['date_of_birth'] !== null ? (string)$r['date_of_birth'] : '',
    'gender' => isset($r['gender']) && $r['gender'] !== null ? (string)$r['gender'] : '',
    'email' => isset($r['email']) && $r['email'] !== null ? (string)$r['email'] : '',
    'homePhone' => isset($r['home_phone']) && $r['home_phone'] !== null ? (string)$r['home_phone'] : '',
    'soloStatus' => isset($r['solo_status']) && $r['solo_status'] !== null ? (string)$r['solo_status'] : '',
    'isDuetOrTrio' => isset($r['is_duet_or_trio']) ? (int)$r['is_duet_or_trio'] : 0,
    'ageDivision' => $r['age_division'] !== null ? (string)$r['age_division'] : '',
    'eventSelections' => $sels,
    // Raw JSON string for admin editing UI
    'eventSelectionsJson' => isset($r['event_selections_json']) && $r['event_selections_json'] !== null ? (string)$r['event_selections_json'] : '[]',
    'eventSubtotal' => (float)$r['event_subtotal'],
    'facilityFee' => (float)$r['facility_fee'],
    'optionalProductSelected' => isset($r['optional_product_selected']) ? (int)$r['optional_product_selected'] : 0,
    'optionalProductName' => isset($r['optional_product_name']) && $r['optional_product_name'] !== null ? (string)$r['optional_product_name'] : '',
    'optionalProductPrice' => isset($r['optional_product_price']) ? (float)$r['optional_product_price'] : 0.0,
    'eventTotal' => (float)$r['event_total'],
    'paymentStatus' => isset($r['payment_status']) && $r['payment_status'] !== null ? (string)$r['payment_status'] : 'pending',
    'paymentProvider' => isset($r['payment_provider']) && $r['payment_provider'] !== null ? (string)$r['payment_provider'] : null,
    'paymentTransactionId' => isset($r['payment_transaction_id']) ? (int)$r['payment_transaction_id'] : null,
    'createdAt' => (string)$r['created_at'],
  ];
}

// If selections don't include names, map ids -> names from event_options
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
  'pagination' => [
    'total' => $total,
    'page' => $page,
    'perPage' => $perPage,
    'totalPages' => $totalPages,
    'hasMore' => $page < $totalPages,
  ],
]);
