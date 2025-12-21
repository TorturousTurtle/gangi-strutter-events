<?php
// web/api/admin_auth.php
// Simple HTTP Basic Auth guard for PHP dev server (php -S).
// In production behind Apache Basic Auth, this still works as a fallback.

function require_admin_auth(): void {
  $user = $_SERVER['PHP_AUTH_USER'] ?? null;
  $pass = $_SERVER['PHP_AUTH_PW'] ?? null;

  // Load secrets/config from outside web root
  $cfg = require __DIR__ . '/../../server/config.php';
  $admin = $cfg['admin'] ?? [];

  $okUser = isset($admin['user']) && $user === $admin['user'];
  $okPass = isset($admin['pass']) && $pass === $admin['pass'];

  if (!$okUser || !$okPass) {
    header('WWW-Authenticate: Basic realm="Admin Area"');
    http_response_code(401);
    echo 'Unauthorized';
    exit;
  }
}
