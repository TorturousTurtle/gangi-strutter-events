

<?php
// web/api/registrations.delete.php
// Admin: delete a single registration by id

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/admin_auth.php';

require_admin_auth();

allow_cors();
require_method('POST');

$pdo = require __DIR__ . '/db.php';

$raw = file_get_contents('php://input');
$payload = $raw ? json_decode($raw, true) : null;
if (!is_array($payload)) {
  json_response(['ok' => false, 'error' => 'Invalid JSON body.'], 400);
}

$id = isset($payload['id']) ? (int)$payload['id'] : 0;
if ($id <= 0) {
  json_response(['ok' => false, 'error' => 'Missing or invalid id.'], 400);
}

try {
  // Ensure it exists
  $stmt = $pdo->prepare('SELECT id FROM registrations WHERE id = ? LIMIT 1');
  $stmt->execute([$id]);
  $row = $stmt->fetch();
  if (!$row) {
    json_response(['ok' => false, 'error' => 'Registration not found.'], 404);
  }

  // Delete
  $stmt = $pdo->prepare('DELETE FROM registrations WHERE id = ?');
  $stmt->execute([$id]);

  json_response(['ok' => true, 'id' => $id]);
} catch (Throwable $e) {
  json_response(['ok' => false, 'error' => 'Failed to delete registration.'], 500);
}
