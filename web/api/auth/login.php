<?php
/**
 * Login Endpoint
 *
 * POST /api/auth/login.php
 * Authenticates user with username and password.
 * Rate limited to 5 attempts per 15 minutes per IP.
 *
 * Request body:
 *   { "username": "...", "password": "..." }
 *
 * Response:
 *   { "ok": true, "csrf_token": "..." }
 *   { "ok": false, "error": "..." }
 */

require_once __DIR__ . '/../../../server/lib/Response.php';
require_once __DIR__ . '/../../../server/lib/Session.php';
require_once __DIR__ . '/../../../server/lib/Csrf.php';
require_once __DIR__ . '/../../../server/lib/RateLimiter.php';
require_once __DIR__ . '/../../../server/lib/AuditLog.php';

// Only allow POST
Response::requireMethod('POST');

// Rate limiting: 5 attempts per 15 minutes per IP
$rateLimiter = new RateLimiter('login', 5, 900);
$ip = RateLimiter::getClientIp();

if (!$rateLimiter->check($ip)) {
    $retryAfter = $rateLimiter->resetIn($ip);
    Response::error(
        'Too many login attempts. Please try again later.',
        429,
        ['retry_after' => $retryAfter]
    );
}

// Parse request body
$body = Response::getJsonBody();
$username = trim($body['username'] ?? '');
$password = $body['password'] ?? '';

if (empty($username) || empty($password)) {
    Response::error('Username and password are required', 400);
}

// Attempt login
if (Session::login($username, $password)) {
    // Generate new CSRF token on successful login
    $csrfToken = Csrf::regenerate();

    // Reset rate limiter on successful login
    $rateLimiter->reset($ip);

    // Log successful login
    AuditLog::logLoginSuccess($username);

    Response::success([
        'message' => 'Login successful',
        'csrf_token' => $csrfToken,
    ]);
}

// Log failed login
AuditLog::logLoginFailed($username);

// Login failed
Response::error('Invalid username or password', 401);
