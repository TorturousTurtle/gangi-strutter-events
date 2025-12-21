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
if (!$row) {
  json_response(['ok' => false, 'error' => 'Competition not found'], 404);
}

// Decode registration fields JSON
$row['eventCatalog'] = $row['event_catalog_json'] ? json_decode($row['event_catalog_json'], true) : [];
$row['registrationOptions'] = $row['registration_config_json'] ? json_decode($row['registration_config_json'], true) : [];
unset($row['event_catalog_json'], $row['registration_config_json']);

json_response(['ok' => true, 'competition' => $row]);
