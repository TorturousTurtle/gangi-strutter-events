<?php
require_once __DIR__ . '/util.php';
require_once __DIR__ . '/admin_auth.php';
require_admin_auth();

allow_cors();
require_method('GET');

$pdo = require __DIR__ . '/db.php';

$stmt = $pdo->query("
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
  ORDER BY is_current DESC, start_at DESC, id DESC
");

$rows = $stmt->fetchAll();

foreach ($rows as &$r) {
  $r['eventCatalog'] = $r['event_catalog_json'] ? json_decode($r['event_catalog_json'], true) : [];
  $r['registrationOptions'] = $r['registration_config_json'] ? json_decode($r['registration_config_json'], true) : [];
  unset($r['event_catalog_json'], $r['registration_config_json']);
}
unset($r);

json_response(['ok' => true, 'competitions' => $rows]);
