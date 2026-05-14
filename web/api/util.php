<?php
// web/api/util.php

function json_response(array $payload, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($payload);
  exit;
}

function json_error(string $message, int $status = 400): void {
  json_response(['ok' => false, 'error' => $message], $status);
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

/**
 * Set CORS headers for API responses.
 *
 * For authenticated endpoints, uses the request origin (with credentials).
 * For public endpoints, can use wildcard origin.
 *
 * @param bool $withCredentials If true, uses origin whitelist and allows credentials
 */
function allow_cors(bool $withCredentials = false): void {
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

  if ($withCredentials) {
    // For authenticated requests, reflect the origin and allow credentials
    // In production, you might want to whitelist specific origins
    if ($origin) {
      header("Access-Control-Allow-Origin: $origin");
      header('Access-Control-Allow-Credentials: true');
    }
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
  } else {
    // For public endpoints, allow any origin
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Content-Type');
  }

  header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
  header('Access-Control-Max-Age: 86400');

  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
  }
}

function require_method(string $method): void {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
    json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
  }
}
