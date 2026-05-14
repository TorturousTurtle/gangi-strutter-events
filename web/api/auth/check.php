<?php
/**
 * Auth Status Check Endpoint
 *
 * GET /api/auth/check.php
 * Returns current authentication status and CSRF token.
 *
 * Response:
 *   { "ok": true, "authenticated": true, "user": "admin", "csrf_token": "..." }
 *   { "ok": true, "authenticated": false }
 */

require_once __DIR__ . '/../../../server/lib/Response.php';
require_once __DIR__ . '/../../../server/lib/Session.php';
require_once __DIR__ . '/../../../server/lib/Csrf.php';

// Only allow GET
Response::requireMethod('GET');

$info = Session::getInfo();

if ($info['authenticated']) {
    Response::success([
        'authenticated' => true,
        'user' => $info['user'],
        'csrf_token' => Csrf::getToken(),
    ]);
}

Response::success([
    'authenticated' => false,
]);
