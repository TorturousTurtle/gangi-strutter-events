<?php
// web/api/event_options.list.php

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/admin_auth.php';
require_admin_auth();

allow_cors();
require_method('GET');

$pdo = require __DIR__ . '/db.php';

// Check if category column exists (migration may not have run yet)
$hasCategory = false;
try {
  $chk = $pdo->query("SHOW COLUMNS FROM event_options LIKE 'category'");
  $hasCategory = (bool)$chk->fetch();
} catch (Throwable $e) {
  $hasCategory = false;
}

// Check if event_group column exists
$hasEventGroup = false;
try {
  $chk = $pdo->query("SHOW COLUMNS FROM event_options LIKE 'event_group'");
  $hasEventGroup = (bool)$chk->fetch();
} catch (Throwable $e) {
  $hasEventGroup = false;
}

if ($hasCategory && $hasEventGroup) {
  $stmt = $pdo->query("
    SELECT
      id,
      name,
      default_price,
      category,
      category_order,
      event_group
    FROM event_options
    WHERE is_active = 1
    ORDER BY category_order ASC, event_group ASC, name ASC, id ASC
  ");
} else if ($hasCategory) {
  $stmt = $pdo->query("
    SELECT
      id,
      name,
      default_price,
      category,
      category_order
    FROM event_options
    WHERE is_active = 1
    ORDER BY category_order ASC, name ASC, id ASC
  ");
} else {
  $stmt = $pdo->query("
    SELECT
      id,
      name,
      default_price
    FROM event_options
    WHERE is_active = 1
    ORDER BY name ASC, id ASC
  ");
}

$rows = $stmt->fetchAll();

// Load categories if table exists
$categories = [];
try {
  $catStmt = $pdo->query("SELECT id, name, slug, description, display_order FROM event_categories WHERE is_active = 1 ORDER BY display_order ASC");
  $categories = $catStmt->fetchAll();
} catch (Throwable $e) {
  // Table doesn't exist yet, use empty array
}

json_response([
  'ok' => true,
  'eventOptions' => $rows,
  'categories' => $categories,
  'hasCategories' => $hasCategory
]);
