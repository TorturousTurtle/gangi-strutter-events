<?php
// web/api/competition_coaches.save.php

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/admin_auth.php';
require_admin_auth();

allow_cors();
require_method('POST');

$pdo = require __DIR__ . '/db.php';

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

$competition_id = isset($body['competition_id']) ? intval($body['competition_id']) : 0;
$items = isset($body['items']) && is_array($body['items']) ? $body['items'] : [];

if ($competition_id <= 0) {
  json_response(['ok' => false, 'error' => 'Missing or invalid competition_id'], 400);
  exit;
}

try {
  $pdo->beginTransaction();

  // Reset config for this competition
  $del = $pdo->prepare("DELETE FROM competition_coaches WHERE competition_id = ?");
  $del->execute([$competition_id]);

  if (count($items) > 0) {
    $ins = $pdo->prepare("
      INSERT INTO competition_coaches
        (competition_id, coach_id, include_on_registration, include_code_on_judging_sheet, sort_order)
      VALUES
        (:competition_id, :coach_id, :include_on_registration, :include_code_on_judging_sheet, :sort_order)
    ");

    foreach ($items as $it) {
      $coach_id = isset($it['coach_id']) ? intval($it['coach_id']) : 0;
      if ($coach_id <= 0) continue;

      $include_on_registration = !empty($it['include_on_registration']) ? 1 : 0;
      $include_code_on_judging_sheet = !empty($it['include_code_on_judging_sheet']) ? 1 : 0;

      $sort_order = null;
      if (array_key_exists('sort_order', $it) && $it['sort_order'] !== null && $it['sort_order'] !== '') {
        $sort_order = intval($it['sort_order']);
      }

      // Store only meaningful rows (keeps table small)
      if ($include_on_registration === 0 && $include_code_on_judging_sheet === 0 && $sort_order === null) {
        continue;
      }

      $ins->execute([
        'competition_id' => $competition_id,
        'coach_id' => $coach_id,
        'include_on_registration' => $include_on_registration,
        'include_code_on_judging_sheet' => $include_code_on_judging_sheet,
        'sort_order' => $sort_order,
      ]);
    }
  }

  $pdo->commit();

  json_response([
    'ok' => true,
    'competitionId' => $competition_id
  ]);
} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  json_response(['ok' => false, 'error' => 'Save failed'], 500);
}
