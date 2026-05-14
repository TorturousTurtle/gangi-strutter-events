<?php
/**
 * Session Management
 *
 * Handles session-based authentication with secure configuration.
 * Sessions have an 8-hour lifetime with secure cookie flags.
 */

class Session
{
    /**
     * Session lifetime in seconds (8 hours).
     */
    private const LIFETIME = 28800;

    /**
     * Session name.
     */
    private const SESSION_NAME = 'ADMIN_SESSION';

    /**
     * Whether session has been initialized this request.
     */
    private static bool $initialized = false;

    /**
     * Start the session with secure configuration.
     */
    public static function start(): void
    {
        if (self::$initialized) {
            return;
        }

        if (session_status() === PHP_SESSION_ACTIVE) {
            self::$initialized = true;
            return;
        }

        $cfg = require __DIR__ . '/../config.php';
        $isProduction = ($cfg['app']['env'] ?? 'production') === 'production';

        session_name(self::SESSION_NAME);

        session_set_cookie_params([
            'lifetime' => self::LIFETIME,
            'path' => '/',
            'domain' => '',
            'secure' => $isProduction,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);

        // Configure session
        ini_set('session.gc_maxlifetime', (string) self::LIFETIME);
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');

        session_start();

        self::$initialized = true;
    }

    /**
     * Check if the current session is authenticated.
     *
     * @return bool True if authenticated
     */
    public static function isAuthenticated(): bool
    {
        self::start();
        return isset($_SESSION['authenticated']) && $_SESSION['authenticated'] === true;
    }

    /**
     * Attempt to log in with username and password.
     *
     * @param string $user Username
     * @param string $pass Password
     * @return bool True if login successful
     */
    public static function login(string $user, string $pass): bool
    {
        self::start();

        $cfg = require __DIR__ . '/../config.php';
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
                error_log('[Session] WARNING: Using plaintext ADMIN_PASS is deprecated. Use ADMIN_PASS_HASH with bcrypt.');
            }
        }

        if ($validUser && $validPass) {
            // Regenerate session ID to prevent fixation attacks
            session_regenerate_id(true);

            $_SESSION['authenticated'] = true;
            $_SESSION['user'] = $user;
            $_SESSION['login_time'] = time();
            $_SESSION['ip'] = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

            return true;
        }

        return false;
    }

    /**
     * Log out and destroy the session.
     */
    public static function logout(): void
    {
        self::start();

        // Clear session data
        $_SESSION = [];

        // Delete session cookie
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'],
                $params['domain'],
                $params['secure'],
                $params['httponly']
            );
        }

        // Destroy session
        session_destroy();

        self::$initialized = false;
    }

    /**
     * Require authentication. Sends 401 response if not authenticated.
     * This is a drop-in replacement for require_admin_auth().
     */
    public static function requireAuth(): void
    {
        if (!self::isAuthenticated()) {
            // Check for Basic Auth fallback (backward compatibility)
            if (self::checkBasicAuth()) {
                return;
            }

            require_once __DIR__ . '/Response.php';
            Response::unauthorized('Authentication required');
        }
    }

    /**
     * Check HTTP Basic Auth credentials (backward compatibility).
     *
     * @return bool True if valid Basic Auth credentials provided
     */
    private static function checkBasicAuth(): bool
    {
        $user = $_SERVER['PHP_AUTH_USER'] ?? null;
        $pass = $_SERVER['PHP_AUTH_PW'] ?? null;

        if ($user === null || $pass === null) {
            return false;
        }

        $cfg = require __DIR__ . '/../config.php';
        $admin = $cfg['admin'] ?? [];

        $validUser = ($admin['user'] ?? '') === $user;
        $validPass = false;

        // Check bcrypt hash first
        if (!empty($admin['pass_hash'])) {
            $validPass = password_verify($pass, $admin['pass_hash']);
        } elseif (!empty($admin['pass'])) {
            $validPass = $admin['pass'] === $pass;
        }

        return $validUser && $validPass;
    }

    /**
     * Get the current session user.
     *
     * @return string|null Username or null if not authenticated
     */
    public static function getUser(): ?string
    {
        self::start();
        return $_SESSION['user'] ?? null;
    }

    /**
     * Get session data for status checks.
     *
     * @return array Session info
     */
    public static function getInfo(): array
    {
        self::start();

        if (!self::isAuthenticated()) {
            return ['authenticated' => false];
        }

        return [
            'authenticated' => true,
            'user' => $_SESSION['user'] ?? null,
            'login_time' => $_SESSION['login_time'] ?? null,
        ];
    }
}
