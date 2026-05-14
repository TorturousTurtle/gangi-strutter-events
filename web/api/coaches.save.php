<?php
// web/api/coaches.save.php

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/admin_auth.php';
require_admin_auth();

allow_cors();
require_method('POST');

$pdo = require __DIR__ . '/db.php';
$body = read_json_body();

$id = isset($body['id']) ? (int)$body['id'] : 0;
$name = trim((string)($body['name'] ?? ''));
$code = strtoupper(trim((string)($body['internal_code'] ?? '')));
$is_active = isset($body['is_active']) ? (int)!!$body['is_active'] : 1;

if ($name === '') json_response(['ok' => false, 'error' => 'Name is required.'], 400);
if ($code === '') json_response(['ok' => false, 'error' => 'Internal code is required.'], 400);

try {
  if ($id > 0) {
    // Update
    $stmt = $pdo->prepare("
      UPDATE coaches
      SET name = :name,
          internal_code = :code,
          is_active = :is_active
      WHERE id = :id
      LIMIT 1
    ");
    $stmt->execute([
      ':name' => $name,
      ':code' => $code,
      ':is_active' => $is_active,
      ':id' => $id,
    ]);

    json_response(['ok' => true, 'id' => $id]);
  } else {
    // Insert
    $stmt = $pdo->prepare("
      INSERT INTO coaches (name, internal_code, is_active)
      VALUES (:name, :code, :is_active)
    ");
    $stmt->execute([
      ':name' => $name,
      ':code' => $code,
      ':is_active' => $is_active,
    ]);

    json_response(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
  }
} catch (PDOException $e) {
  // Likely duplicate internal_code if you add a UNIQUE constraint
  json_response(['ok' => false, 'error' => 'Failed to save coach.'], 500);
}
