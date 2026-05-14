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

// Optional product (e.g., T-shirt) controlled by admin
$productEnabled = !empty($body['productEnabled']) ? 1 : 0;
$productName = trim((string)($body['productName'] ?? ''));
$productPrice = isset($body['productPrice']) ? (float)$body['productPrice'] : 0.0;
if ($productPrice < 0) $productPrice = 0.0;

// If not enabled, store empty/zero
if ($productEnabled !== 1) {
  $productName = '';
  $productPrice = 0.0;
}

// Competition image (optional)
$imageUrl = isset($body['imageUrl']) ? trim((string)$body['imageUrl']) : null;
// Security: only allow URLs from our uploads directory
if ($imageUrl !== null && $imageUrl !== '' && strpos($imageUrl, '/assets/uploads/') !== 0) {
  $imageUrl = null;
}
if ($imageUrl === '') $imageUrl = null;

// Home page display settings
$showOnHome = !empty($body['showOnHome']) ? 1 : 0;
$displayOrder = isset($body['displayOrder']) ? (int)$body['displayOrder'] : 0;
if ($displayOrder < 0) $displayOrder = 0;

// Registration fields (optional)
$eventCatalog = $body['eventCatalog'] ?? null;
$registrationOptions = $body['registrationOptions'] ?? null;
$fieldsConfig = $body['fieldsConfig'] ?? null;

$eventCatalogJson = is_array($eventCatalog) ? json_encode($eventCatalog) : null;
$registrationOptionsJson = null; // encoded later (may be normalized/expanded)
$fieldsConfigJson = is_array($fieldsConfig) ? json_encode($fieldsConfig) : null;

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
  // Check if category column exists on event_options (migration may not have run yet)
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

  // Check if image_url column exists on competitions
  $hasImageUrl = false;
  try {
    $chk = $pdo->query("SHOW COLUMNS FROM competitions LIKE 'image_url'");
    $hasImageUrl = (bool)$chk->fetch();
  } catch (Throwable $e) {
    $hasImageUrl = false;
  }

  // Check if show_on_home column exists
  $hasShowOnHome = false;
  try {
    $chk = $pdo->query("SHOW COLUMNS FROM competitions LIKE 'show_on_home'");
    $hasShowOnHome = (bool)$chk->fetch();
  } catch (Throwable $e) {
    $hasShowOnHome = false;
  }

  // If registrationOptions includes draft rows (isNew/newName), create those in event_options
  if (is_array($registrationOptions)) {
    $normalized = [];
    $removedEventIds = null;

    foreach ($registrationOptions as $opt) {
      if (!is_array($opt)) continue;

      // Preserve _removedEventIds metadata
      if (isset($opt['_removedEventIds'])) {
        $removedEventIds = $opt['_removedEventIds'];
        continue;
      }

      $included = !empty($opt['included']) ? 1 : 0;
      $price = isset($opt['price']) ? (float)$opt['price'] : 0.0;
      if ($price < 0) $price = 0.0;
      $category = isset($opt['category']) ? trim((string)$opt['category']) : null;
      if ($category === '') $category = null;
      $eventGroup = isset($opt['eventGroup']) ? trim((string)$opt['eventGroup']) : null;
      if ($eventGroup === '') $eventGroup = null;

      // Existing option (dropdown)
      $optionId = isset($opt['optionId']) ? (int)$opt['optionId'] : 0;

      // New option (text input)
      $isNew = !empty($opt['isNew']);
      $newName = trim((string)($opt['newName'] ?? ''));

      if (($optionId <= 0) && $isNew && $newName !== '') {
        // Create (or reuse) an event option by UNIQUE name.
        // LAST_INSERT_ID(id) lets us fetch the existing row id via lastInsertId().
        if ($hasCategory && $hasEventGroup) {
          $stmt = $pdo->prepare(
            "INSERT INTO event_options (name, default_price, category, event_group, is_active)\n" .
            "VALUES (?, ?, ?, ?, 1)\n" .
            "ON DUPLICATE KEY UPDATE\n" .
            "  id = LAST_INSERT_ID(id),\n" .
            "  default_price = VALUES(default_price),\n" .
            "  category = VALUES(category),\n" .
            "  event_group = VALUES(event_group),\n" .
            "  is_active = 1"
          );
          $stmt->execute([$newName, $price, $category, $eventGroup]);
        } else if ($hasCategory) {
          $stmt = $pdo->prepare(
            "INSERT INTO event_options (name, default_price, category, is_active)\n" .
            "VALUES (?, ?, ?, 1)\n" .
            "ON DUPLICATE KEY UPDATE\n" .
            "  id = LAST_INSERT_ID(id),\n" .
            "  default_price = VALUES(default_price),\n" .
            "  category = VALUES(category),\n" .
            "  is_active = 1"
          );
          $stmt->execute([$newName, $price, $category]);
        } else {
          $stmt = $pdo->prepare(
            "INSERT INTO event_options (name, default_price, is_active)\n" .
            "VALUES (?, ?, 1)\n" .
            "ON DUPLICATE KEY UPDATE\n" .
            "  id = LAST_INSERT_ID(id),\n" .
            "  default_price = VALUES(default_price),\n" .
            "  is_active = 1"
          );
          $stmt->execute([$newName, $price]);
        }
        $optionId = (int)$pdo->lastInsertId();
      } else if ($optionId > 0) {
        // Update category and event_group for existing event option
        if ($hasCategory && $hasEventGroup) {
          $stmt = $pdo->prepare("UPDATE event_options SET category = ?, event_group = ? WHERE id = ?");
          $stmt->execute([$category, $eventGroup, $optionId]);
        } else if ($hasCategory) {
          $stmt = $pdo->prepare("UPDATE event_options SET category = ? WHERE id = ?");
          $stmt->execute([$category, $optionId]);
        }
      }

      // Keep the row even if optionId is still empty (user may have added a blank row)
      $normalized[] = [
        'optionId' => $optionId > 0 ? (string)$optionId : '',
        'price' => $price,
        'included' => $included ? true : false,
        'category' => $category,
        'eventGroup' => $eventGroup,
      ];
    }

    // Preserve removed event IDs metadata
    if ($removedEventIds !== null && is_array($removedEventIds) && count($removedEventIds) > 0) {
      $normalized[] = ['_removedEventIds' => $removedEventIds];
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

  // Build dynamic column lists based on available columns
  $baseCols = "name = ?, location = ?, start_at = ?, end_at = ?, registration_deadline = ?, facility_fee = ?, is_current = ?, event_catalog_json = ?, registration_config_json = ?, fields_config_json = ?, product_enabled = ?, product_name = ?, product_price = ?, description = ?";
  $baseParams = [$name, $location ?: null, $start_at, $end_at, $deadline, $facilityFee, $isActive, $eventCatalogJson, $registrationOptionsJson, $fieldsConfigJson, $productEnabled, $productName ?: null, $productPrice, $description];

  $extraCols = "";
  $extraParams = [];
  if ($hasImageUrl) {
    $extraCols .= ", image_url = ?";
    $extraParams[] = $imageUrl;
  }
  if ($hasShowOnHome) {
    $extraCols .= ", show_on_home = ?, display_order = ?";
    $extraParams[] = $showOnHome;
    $extraParams[] = $displayOrder;
  }

  if ($id > 0) {
    $stmt = $pdo->prepare("UPDATE competitions SET {$baseCols}{$extraCols} WHERE id = ?");
    $stmt->execute(array_merge($baseParams, $extraParams, [$id]));
  } else {
    // Build INSERT column names
    $insertCols = "name, location, start_at, end_at, registration_deadline, facility_fee, is_current, event_catalog_json, registration_config_json, fields_config_json, product_enabled, product_name, product_price, description";
    $insertPlaceholders = "?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?";
    $insertParams = $baseParams;

    if ($hasImageUrl) {
      $insertCols .= ", image_url";
      $insertPlaceholders .= ", ?";
      $insertParams[] = $imageUrl;
    }
    if ($hasShowOnHome) {
      $insertCols .= ", show_on_home, display_order";
      $insertPlaceholders .= ", ?, ?";
      $insertParams[] = $showOnHome;
      $insertParams[] = $displayOrder;
    }

    $stmt = $pdo->prepare("INSERT INTO competitions ({$insertCols}) VALUES ({$insertPlaceholders})");
    $stmt->execute($insertParams);
    $id = (int)$pdo->lastInsertId();
  }

  $imageUrlSelect = $hasImageUrl ? ", image_url AS imageUrl" : "";
  $homeDisplaySelect = $hasShowOnHome ? ", show_on_home AS showOnHome, display_order AS displayOrder" : "";
  $stmt = $pdo->prepare("
    SELECT
      id,
      name,
      location,
      start_at,
      end_at,
      registration_deadline,
      facility_fee,
      product_enabled AS productEnabled,
      product_name AS productName,
      product_price AS productPrice,
      is_current AS isActive,
      event_catalog_json,
      registration_config_json,
      fields_config_json,
      description
      {$imageUrlSelect}
      {$homeDisplaySelect}
    FROM competitions
    WHERE id = ?
    LIMIT 1
  ");
  $stmt->execute([$id]);
  $row = $stmt->fetch();

  // Decode registration fields JSON
  $row['eventCatalog'] = $row['event_catalog_json'] ? json_decode($row['event_catalog_json'], true) : [];
  $row['registrationOptions'] = $row['registration_config_json'] ? json_decode($row['registration_config_json'], true) : [];
  $row['fieldsConfig'] = $row['fields_config_json'] ? json_decode($row['fields_config_json'], true) : null;
  unset($row['event_catalog_json'], $row['registration_config_json'], $row['fields_config_json']);

  $pdo->commit();
  json_response(['ok' => true, 'competition' => $row]);
} catch (Throwable $e) {
  $pdo->rollBack();
  json_response(['ok' => false, 'error' => 'Save failed'], 500);
}
