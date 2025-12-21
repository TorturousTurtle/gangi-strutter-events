<?php
require_once __DIR__ . '/util.php';
require_once __DIR__ . '/admin_auth.php';
require_admin_auth();
// db.php returns a PDO instance

allow_cors();
require_method('POST');

$body = read_json_body();

$id = isset($body['id']) ? (int)$body['id'] : 0;
$name = trim((string)($body['name'] ?? ''));
require_param($name, 'name');

$location = trim((string)($body['location'] ?? ''));
$description = (string)($body['description'] ?? '');

$isActive = !empty($body['isActive']) ? 1 : 0;

// Convert datetime-local strings (YYYY-MM-DDTHH:MM) to MySQL DATETIME (YYYY-MM-DD HH:MM:SS)
function dt_local_to_mysql($v) {
  if ($v === null) return null;
  $s = trim((string)$v);
  if ($s === '') return null;
  $s = str_replace('T', ' ', $s);
  if (strlen($s) === 16) $s .= ':00';
  return $s;
}

$start_at = dt_local_to_mysql($body['startDate'] ?? null);
$end_at = dt_local_to_mysql($body['endDate'] ?? null);
$deadline = dt_local_to_mysql($body['registrationDeadline'] ?? null);
$facilityFee = isset($body['facilityFee']) ? (float)$body['facilityFee'] : 0.0;
if ($facilityFee < 0) $facilityFee = 0.0;

// Registration fields (optional)
$eventCatalog = $body['eventCatalog'] ?? null;
$registrationOptions = $body['registrationOptions'] ?? null;

$eventCatalogJson = is_array($eventCatalog) ? json_encode($eventCatalog) : null;
$registrationOptionsJson = null; // encoded later (may be normalized/expanded)

require_param($start_at, 'startDate');
require_param($deadline, 'registrationDeadline');

if (!is_array($registrationOptions)) {
  $registrationOptionsJson = null;
} else {
  // placeholder; real encoding happens inside the transaction after normalization
  $registrationOptionsJson = json_encode($registrationOptions);
}

$pdo = require __DIR__ . '/db.php';
// NOTE: We may create new event_options entries from registrationOptions before saving the competition.
$pdo->beginTransaction();

try {
  // If registrationOptions includes draft rows (isNew/newName), create those in event_options
  if (is_array($registrationOptions)) {
    $normalized = [];

    foreach ($registrationOptions as $opt) {
      if (!is_array($opt)) continue;

      $included = !empty($opt['included']) ? 1 : 0;
      $price = isset($opt['price']) ? (float)$opt['price'] : 0.0;
      if ($price < 0) $price = 0.0;

      // Existing option (dropdown)
      $optionId = isset($opt['optionId']) ? (int)$opt['optionId'] : 0;

      // New option (text input)
      $isNew = !empty($opt['isNew']);
      $newName = trim((string)($opt['newName'] ?? ''));

      if (($optionId <= 0) && $isNew && $newName !== '') {
        // Create (or reuse) an event option by UNIQUE name.
        // LAST_INSERT_ID(id) lets us fetch the existing row id via lastInsertId().
        $stmt = $pdo->prepare(
          "INSERT INTO event_options (name, default_price, is_active)\n" .
          "VALUES (?, ?, 1)\n" .
          "ON DUPLICATE KEY UPDATE\n" .
          "  id = LAST_INSERT_ID(id),\n" .
          "  default_price = VALUES(default_price),\n" .
          "  is_active = 1"
        );
        $stmt->execute([$newName, $price]);
        $optionId = (int)$pdo->lastInsertId();
      }

      // Keep the row even if optionId is still empty (user may have added a blank row)
      $normalized[] = [
        'optionId' => $optionId > 0 ? (string)$optionId : '',
        'price' => $price,
        'included' => $included ? true : false,
      ];
    }

    $registrationOptions = $normalized;
    $registrationOptionsJson = json_encode($registrationOptions);
  }

  // If setting active, clear others first (enforces only one active)
  if ($isActive === 1) {
    if ($id > 0) {
      $stmt = $pdo->prepare("UPDATE competitions SET is_current = 0 WHERE id <> ?");
      $stmt->execute([$id]);
    } else {
      $pdo->exec("UPDATE competitions SET is_current = 0");
    }
  }

  if ($id > 0) {
    $stmt = $pdo->prepare("
      UPDATE competitions
      SET name = ?, location = ?, start_at = ?, end_at = ?, registration_deadline = ?, facility_fee = ?, is_current = ?, event_catalog_json = ?, registration_config_json = ?, description = ?
      WHERE id = ?
    ");
    $stmt->execute([$name, $location ?: null, $start_at, $end_at, $deadline, $facilityFee, $isActive, $eventCatalogJson, $registrationOptionsJson, $description, $id]);
  } else {
    $stmt = $pdo->prepare("
      INSERT INTO competitions (name, location, start_at, end_at, registration_deadline, facility_fee, is_current, event_catalog_json, registration_config_json, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([$name, $location ?: null, $start_at, $end_at, $deadline, $facilityFee, $isActive, $eventCatalogJson, $registrationOptionsJson, $description]);
    $id = (int)$pdo->lastInsertId();
  }

  $stmt = $pdo->prepare("
    SELECT
      id,
      name,
      location,
      start_at,
      end_at,
      registration_deadline,
      facility_fee,
      is_current AS isActive,
      event_catalog_json,
      registration_config_json,
      description
    FROM competitions
    WHERE id = ?
    LIMIT 1
  ");
  $stmt->execute([$id]);
  $row = $stmt->fetch();

  // Decode registration fields JSON
  $row['eventCatalog'] = $row['event_catalog_json'] ? json_decode($row['event_catalog_json'], true) : [];
  $row['registrationOptions'] = $row['registration_config_json'] ? json_decode($row['registration_config_json'], true) : [];
  unset($row['event_catalog_json'], $row['registration_config_json']);

  $pdo->commit();
  json_response(['ok' => true, 'competition' => $row]);
} catch (Throwable $e) {
  $pdo->rollBack();
  json_response(['ok' => false, 'error' => 'Save failed'], 500);
}
