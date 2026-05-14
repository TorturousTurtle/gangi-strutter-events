<?php
// web/api/coaches.get.php

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/admin_auth.php';
require_admin_auth();

allow_cors();
require_method('GET');

$pdo = require __DIR__ . '/db.php';
$id = (int)($_GET['id'] ?? 0);
if ($id <= 0) json_response(['ok' => false, 'error' => 'id is required.'], 400);

$stmt = $pdo->prepare("SELECT id, name, internal_code, is_active FROM coaches WHERE id = :id LIMIT 1");
$stmt->execute([':id' => $id]);
$row = $stmt->fetch();

json_response(['ok' => true, 'coach' => $row ?: null]);
