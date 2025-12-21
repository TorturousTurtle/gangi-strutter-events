<?php
require_once __DIR__ . '/util.php';
require_once __DIR__ . '/admin_auth.php';
require_admin_auth();
require_once __DIR__ . '/db.php';

allow_cors();
require_method('POST');

$body = read_json_body();
$id = isset($body['id']) ? (int)$body['id'] : 0;

if ($id <= 0) {
  json_response(['ok' => false, 'error' => 'Missing or invalid id'], 400);
}

$pdo = require __DIR__ . '/db.php';

$stmt = $pdo->prepare("DELETE FROM competitions WHERE id = ? LIMIT 1");
$stmt->execute([$id]);

json_response(['ok' => true]);
