<?php
// web/api/util.php

function json_response(array $payload, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($payload);
  exit;
}

function read_json_body(): array {
  $raw = file_get_contents('php://input');
  if (!$raw) return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function require_param($value, string $name): void {
  if ($value === null || $value === '') {
    json_response(['ok' => false, 'error' => "Missing required field: $name"], 400);
  }
}

// Optional but helpful for local dev / static frontend calling /api
function allow_cors(): void {
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Headers: Content-Type');
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
  }
}

function require_method(string $method): void {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
    json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
  }
}
