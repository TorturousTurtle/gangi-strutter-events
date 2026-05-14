<?php
// web/api/coaches.delete.php

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/admin_auth.php';
require_admin_auth();

allow_cors();
require_method('POST');

$pdo = require __DIR__ . '/db.php';
$body = read_json_body();

$id = (int)($body['id'] ?? 0);
if ($id <= 0) json_response(['ok' => false, 'error' => 'id is required.'], 400);

try {
  // Hard delete
  $stmt = $pdo->prepare("DELETE FROM coaches WHERE id = :id LIMIT 1");
  $stmt->execute([':id' => $id]);

  json_response(['ok' => true]);
} catch (PDOException $e) {
  json_response(['ok' => false, 'error' => 'Failed to delete coach.'], 500);
}
