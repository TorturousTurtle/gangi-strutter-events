<?php
// web/api/event_options.list.php

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
    default_price
  FROM event_options
  WHERE is_active = 1
  ORDER BY name ASC, id ASC
");

$rows = $stmt->fetchAll();

json_response([
  'ok' => true,
  'eventOptions' => $rows
]);
