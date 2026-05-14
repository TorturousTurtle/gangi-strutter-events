<?php
// web/api/competition_coaches.list.php

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/admin_auth.php';
require_admin_auth();

allow_cors();
require_method('GET');

$competition_id = isset($_GET['competition_id']) ? intval($_GET['competition_id']) : 0;
if ($competition_id <= 0) {
  json_response(['ok' => false, 'error' => 'Missing or invalid competition_id'], 400);
  exit;
}

$pdo = require __DIR__ . '/db.php';

$stmt = $pdo->prepare("
  SELECT
    c.id AS coach_id,
    c.name,
    c.internal_code,
    COALESCE(cc.include_on_registration, 0) AS include_on_registration,
    COALESCE(cc.include_code_on_judging_sheet, 0) AS include_code_on_judging_sheet,
    cc.sort_order
  FROM coaches c
  LEFT JOIN competition_coaches cc
    ON cc.coach_id = c.id
   AND cc.competition_id = :competition_id
  WHERE c.is_active = 1
  ORDER BY c.name ASC, c.id ASC
");
$stmt->execute(['competition_id' => $competition_id]);

$rows = $stmt->fetchAll();

json_response([
  'ok' => true,
  'competitionId' => $competition_id,
  'coaches' => $rows
]);
