<?php
require_once __DIR__ . '/util.php';

allow_cors();
require_method('GET');

$pdo = require __DIR__ . '/db.php';

// Check if image_url column exists (migration may not have run yet)
$hasImageUrl = false;
try {
  $chk = $pdo->query("SHOW COLUMNS FROM competitions LIKE 'image_url'");
  $hasImageUrl = (bool)$chk->fetch();
} catch (Throwable $e) {
  $hasImageUrl = false;
}

$imageUrlSelect = $hasImageUrl ? ", image_url" : "";

// Fetch the current (active) competition only
$stmt = $pdo->prepare("
  SELECT
    id,
    name,
    location,
    start_at,
    end_at,
    registration_deadline,
    description
    {$imageUrlSelect}
  FROM competitions
  WHERE is_current = 1
  LIMIT 1
");
$stmt->execute();

$comp = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$comp) {
  json_response([
    'ok' => true,
    'competition' => null
  ]);
}

// Normalize keys for frontend consistency
json_response([
  'ok' => true,
  'competition' => [
    'id' => (int)$comp['id'],
    'name' => (string)$comp['name'],
    'location' => (string)$comp['location'],
    'startAt' => $comp['start_at'],
    'endAt' => $comp['end_at'],
    'registrationDeadline' => $comp['registration_deadline'],
    'description' => (string)$comp['description'],
    'imageUrl' => isset($comp['image_url']) ? ($comp['image_url'] ?: null) : null,
  ]
]);
