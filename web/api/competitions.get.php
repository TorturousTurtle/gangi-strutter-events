<?php
require_once __DIR__ . '/util.php';
require_once __DIR__ . '/db.php';

allow_cors();
require_method('GET');

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($id <= 0) {
  json_response(['ok' => false, 'error' => 'Missing or invalid id'], 400);
}

$pdo = require __DIR__ . '/db.php';

// Check which optional columns exist (migrations may not have run yet)
$hasImageUrl = false;
$hasShowOnHome = false;
try {
  $chk = $pdo->query("SHOW COLUMNS FROM competitions LIKE 'image_url'");
  $hasImageUrl = (bool)$chk->fetch();
  $chk = $pdo->query("SHOW COLUMNS FROM competitions LIKE 'show_on_home'");
  $hasShowOnHome = (bool)$chk->fetch();
} catch (Throwable $e) {
  // Ignore
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
if (!$row) {
  json_response(['ok' => false, 'error' => 'Competition not found'], 404);
}

// Decode registration fields JSON
$row['eventCatalog'] = $row['event_catalog_json'] ? json_decode($row['event_catalog_json'], true) : [];
$row['registrationOptions'] = $row['registration_config_json'] ? json_decode($row['registration_config_json'], true) : [];
$row['fieldsConfig'] = $row['fields_config_json'] ? json_decode($row['fields_config_json'], true) : null;
unset($row['event_catalog_json'], $row['registration_config_json'], $row['fields_config_json']);

json_response(['ok' => true, 'competition' => $row]);
