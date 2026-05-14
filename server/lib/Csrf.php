<?php
/**
 * CSRF Protection
 *
 * Generates and validates CSRF tokens stored in the session.
 * Tokens are validated from the X-CSRF-Token header.
 */

class Csrf
{
    /**
     * Session key for storing the CSRF token.
     */
    private const SESSION_KEY = 'csrf_token';

    /**
     * HTTP header name for CSRF token.
     */
    private const HEADER_NAME = 'X-CSRF-Token';

    /**
     * Token length in bytes (32 bytes = 64 hex chars).
     */
    private const TOKEN_LENGTH = 32;

    /**
     * Generate a new CSRF token and store it in the session.
     *
     * @return string The generated token
     */
    public static function generate(): string
    {
        require_once __DIR__ . '/Session.php';
        Session::start();

        $token = bin2hex(random_bytes(self::TOKEN_LENGTH));
        $_SESSION[self::SESSION_KEY] = $token;

        return $token;
    }

    /**
     * Get the current CSRF token, generating one if none exists.
     *
     * @return string The current token
     */
    public static function getToken(): string
    {
        require_once __DIR__ . '/Session.php';
        Session::start();

        if (empty($_SESSION[self::SESSION_KEY])) {
            return self::generate();
        }

        return $_SESSION[self::SESSION_KEY];
    }

    /**
     * Validate the CSRF token from the request.
     * Checks the X-CSRF-Token header.
     *
     * @return bool True if valid
     */
    public static function isValid(): bool
    {
        require_once __DIR__ . '/Session.php';
        Session::start();

        $sessionToken = $_SESSION[self::SESSION_KEY] ?? null;
        if (empty($sessionToken)) {
            return false;
        }

        // Check header (normalized by PHP to HTTP_X_CSRF_TOKEN)
        $headerToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;

        if ($headerToken === null) {
            return false;
        }

        // Timing-safe comparison
        return hash_equals($sessionToken, $headerToken);
    }

    /**
     * Validate CSRF token and send 403 response if invalid.
     * Skips validation for GET, HEAD, and OPTIONS requests.
     */
    public static function validate(): void
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        // Skip validation for safe methods
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return;
        }

        if (!self::isValid()) {
            require_once __DIR__ . '/Response.php';
            Response::forbidden('Invalid or missing CSRF token');
        }
    }

    /**
     * Regenerate the CSRF token.
     * Call this after successful login to prevent session fixation.
     *
     * @return string The new token
     */
    public static function regenerate(): string
    {
        return self::generate();
    }
}
