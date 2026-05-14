<?php
/**
 * Public Competitions List for Home Page
 *
 * GET /api/competitions.home.php
 * Returns all competitions marked to show on home page, with status badges.
 *
 * Response:
 *   {
 *     "ok": true,
 *     "competitions": [
 *       {
 *         "id": 1,
 *         "name": "Spring Competition 2026",
 *         "location": "Tampa Convention Center",
 *         "startAt": "2026-03-15 09:00:00",
 *         "endAt": "2026-03-17 18:00:00",
 *         "registrationDeadline": "2026-03-01 23:59:59",
 *         "description": "...",
 *         "imageUrl": "/assets/uploads/...",
 *         "status": "registration_open",  // or "coming_soon", "closed"
 *         "isActive": true,
 *         "displayOrder": 1
 *       },
 *       ...
 *     ]
 *   }
 */

require_once __DIR__ . '/util.php';

allow_cors();
require_method('GET');

$pdo = require __DIR__ . '/db.php';

// Check which columns exist (for backward compatibility)
$hasImageUrl = false;
$hasShowOnHome = false;
try {
    $chk = $pdo->query("SHOW COLUMNS FROM competitions LIKE 'image_url'");
    $hasImageUrl = (bool)$chk->fetch();
    $chk = $pdo->query("SHOW COLUMNS FROM competitions LIKE 'show_on_home'");
    $hasShowOnHome = (bool)$chk->fetch();
} catch (Throwable $e) {
    // Ignore
}

// Build query based on available columns
$imageUrlSelect = $hasImageUrl ? ", image_url" : "";
$showOnHomeWhere = $hasShowOnHome ? "WHERE show_on_home = 1" : "WHERE is_current = 1";
$displayOrderSelect = $hasShowOnHome ? ", display_order" : ", 0 AS display_order";
$orderBy = $hasShowOnHome
    ? "ORDER BY display_order ASC, is_current DESC, start_at ASC"
    : "ORDER BY is_current DESC, start_at ASC";

$stmt = $pdo->query("
    SELECT
        id,
        name,
        location,
        start_at,
        end_at,
        registration_deadline,
        description,
        is_current
        {$imageUrlSelect}
        {$displayOrderSelect}
    FROM competitions
    {$showOnHomeWhere}
    {$orderBy}
    LIMIT 10
");

$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
$now = time();

$competitions = [];
foreach ($rows as $row) {
    $isActive = (bool)$row['is_current'];
    $deadline = $row['registration_deadline'] ? strtotime($row['registration_deadline']) : null;
    $startAt = $row['start_at'] ? strtotime($row['start_at']) : null;

    // Determine status
    // - registration_open: is_current=1 AND deadline not passed
    // - closed: deadline passed OR event started
    // - coming_soon: not active, deadline in future or not set
    $status = 'coming_soon';
    if ($isActive && $deadline && $now < $deadline) {
        $status = 'registration_open';
    } elseif ($deadline && $now > $deadline) {
        $status = 'closed';
    } elseif ($startAt && $now > $startAt) {
        $status = 'closed';
    }

    $competitions[] = [
        'id' => (int)$row['id'],
        'name' => (string)$row['name'],
        'location' => (string)$row['location'],
        'startAt' => $row['start_at'],
        'endAt' => $row['end_at'],
        'registrationDeadline' => $row['registration_deadline'],
        'description' => (string)$row['description'],
        'imageUrl' => isset($row['image_url']) ? ($row['image_url'] ?: null) : null,
        'status' => $status,
        'isActive' => $isActive,
        'displayOrder' => (int)$row['display_order'],
    ];
}

json_response([
    'ok' => true,
    'competitions' => $competitions,
]);
