<?php
/**
 * Logout Endpoint
 *
 * POST /api/auth/logout.php
 * Destroys the current session.
 *
 * Response:
 *   { "ok": true, "message": "Logged out" }
 */

require_once __DIR__ . '/../../../server/lib/Response.php';
require_once __DIR__ . '/../../../server/lib/Session.php';
require_once __DIR__ . '/../../../server/lib/AuditLog.php';

// Only allow POST
Response::requireMethod('POST');

// Get username before logout
$username = Session::getUser();

// Destroy session
Session::logout();

// Log logout
AuditLog::logLogout($username);

Response::success(['message' => 'Logged out']);
