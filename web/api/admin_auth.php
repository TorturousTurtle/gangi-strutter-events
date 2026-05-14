<?php
/**
 * Admin Authentication Guard
 *
 * Provides authentication and CSRF protection for admin API endpoints.
 *
 * Authentication is checked in this order:
 * 1. Session-based auth (preferred)
 * 2. HTTP Basic Auth (backward compatibility)
 *
 * CSRF validation is required for POST, PUT, DELETE requests when using session auth.
 *
 * Usage:
 *   require_once __DIR__ . '/admin_auth.php';
 *   require_admin_auth();  // Checks auth only
 *   require_admin_auth_with_csrf();  // Checks auth + CSRF for mutations
 */

require_once __DIR__ . '/../../server/lib/Session.php';
require_once __DIR__ . '/../../server/lib/Csrf.php';
require_once __DIR__ . '/../../server/lib/Response.php';

/**
 * Require admin authentication.
 * Returns 401 if not authenticated.
 */
function require_admin_auth(): void
{
    // Check session auth first
    if (Session::isAuthenticated()) {
        return;
    }

    // Fall back to HTTP Basic Auth for backward compatibility
    $user = $_SERVER['PHP_AUTH_USER'] ?? null;
    $pass = $_SERVER['PHP_AUTH_PW'] ?? null;

    if ($user !== null && $pass !== null) {
        $cfg = require __DIR__ . '/../../server/config.php';
        $admin = $cfg['admin'] ?? [];

        $validUser = ($admin['user'] ?? '') === $user;
        $validPass = false;

        // Check bcrypt hash first (preferred)
        if (!empty($admin['pass_hash'])) {
            $validPass = password_verify($pass, $admin['pass_hash']);
        } elseif (!empty($admin['pass'])) {
            // Fallback to plaintext comparison (deprecated)
            $validPass = $admin['pass'] === $pass;
            if ($validPass) {
                error_log('[admin_auth] WARNING: Using plaintext ADMIN_PASS is deprecated. Use ADMIN_PASS_HASH.');
            }
        }

        if ($validUser && $validPass) {
            return;
        }
    }

    // Not authenticated
    Response::error('Authentication required', 401, ['code' => 'AUTH_REQUIRED']);
}

/**
 * Require admin authentication with CSRF protection for mutations.
 * Checks CSRF token for POST, PUT, DELETE requests when using session auth.
 */
function require_admin_auth_with_csrf(): void
{
    require_admin_auth();

    // CSRF validation only applies to session auth, not Basic Auth
    // Basic Auth users are typically API clients that don't need CSRF protection
    if (Session::isAuthenticated()) {
        Csrf::validate();
    }
}

/**
 * Check if current request is authenticated (without blocking).
 *
 * @return bool True if authenticated via session or Basic Auth
 */
function is_admin_authenticated(): bool
{
    if (Session::isAuthenticated()) {
        return true;
    }

    // Check Basic Auth
    $user = $_SERVER['PHP_AUTH_USER'] ?? null;
    $pass = $_SERVER['PHP_AUTH_PW'] ?? null;

    if ($user === null || $pass === null) {
        return false;
    }

    $cfg = require __DIR__ . '/../../server/config.php';
    $admin = $cfg['admin'] ?? [];

    $validUser = ($admin['user'] ?? '') === $user;
    $validPass = false;

    if (!empty($admin['pass_hash'])) {
        $validPass = password_verify($pass, $admin['pass_hash']);
    } elseif (!empty($admin['pass'])) {
        $validPass = $admin['pass'] === $pass;
    }

    return $validUser && $validPass;
}
