<?php
// web/api/stripe/create-checkout-session.php
// Stub endpoint: DOES NOT call Stripe.
// It exists so the front-end can proceed through the flow while you set up Stripe.
//
// Expected request body (JSON):
// {
//   "registration": { ...draft... },
//   "successUrl": "http://.../thank-you.html?paid=1",
//   "cancelUrl": "http://.../payment.html"
// }
//
// Response (JSON):
// { "ok": true, "url": "<successUrl>" }

header('Content-Type: application/json; charset=UTF-8');

// CORS (dev-friendly)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
  exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);

if (!is_array($payload)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Invalid JSON body']);
  exit;
}

$successUrl = isset($payload['successUrl']) ? trim((string)$payload['successUrl']) : '';
$cancelUrl  = isset($payload['cancelUrl']) ? trim((string)$payload['cancelUrl']) : '';
$reg        = isset($payload['registration']) && is_array($payload['registration']) ? $payload['registration'] : null;

if (!$reg) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Missing registration draft']);
  exit;
}

// Basic sanity checks (keep super light for now)
$email = isset($reg['email']) ? trim((string)$reg['email']) : '';
if ($email === '') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Missing email in registration draft']);
  exit;
}

// If the front-end didn’t provide a successUrl, default to /thank-you.html
if ($successUrl === '') {
  // Works both in php -S dev and on shared hosting
  $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
  $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
  $basePath = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/');
  $successUrl = $scheme . '://' . $host . $basePath . '/../thank-you.html?paid=1';
}

// NOTE: We intentionally do NOT write anything to the DB yet.
// Once Stripe is live, this endpoint will create a Checkout Session and return its URL,
// and your webhook (checkout.session.completed) should finalize the registration.

echo json_encode([
  'ok' => true,
  'url' => $successUrl,
  'stub' => true,
  'cancelUrl' => $cancelUrl,
]);
