<?php
/**
 * Environment Variable Loader
 *
 * Loads configuration from .env files into $_ENV and getenv().
 * Supports variable interpolation and multiple .env file overrides.
 */

class Env
{
    private static bool $loaded = false;
    private static array $values = [];

    /**
     * Load environment variables from .env file(s).
     *
     * @param string|null $path Directory containing .env file (defaults to project root)
     * @return void
     */
    public static function load(?string $path = null): void
    {
        if (self::$loaded) {
            return;
        }

        $path = $path ?? dirname(__DIR__, 2);

        // Load base .env file
        $envFile = $path . '/.env';
        if (file_exists($envFile)) {
            self::loadFile($envFile);
        }

        // Load environment-specific override (e.g., .env.local, .env.production)
        $appEnv = self::get('APP_ENV', 'production');
        $envOverride = $path . '/.env.' . $appEnv;
        if (file_exists($envOverride)) {
            self::loadFile($envOverride);
        }

        // Local overrides always take precedence
        $envLocal = $path . '/.env.local';
        if (file_exists($envLocal)) {
            self::loadFile($envLocal);
        }

        self::$loaded = true;
    }

    /**
     * Parse and load a single .env file.
     *
     * @param string $file Path to .env file
     * @return void
     */
    private static function loadFile(string $file): void
    {
        $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        foreach ($lines as $line) {
            // Skip comments
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            // Parse KEY=value
            if (strpos($line, '=') === false) {
                continue;
            }

            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);

            // Remove surrounding quotes if present
            if (preg_match('/^(["\'])(.*)\\1$/', $value, $matches)) {
                $value = $matches[2];
            }

            // Store and export
            self::$values[$key] = $value;
            $_ENV[$key] = $value;
            putenv("$key=$value");
        }
    }

    /**
     * Get an environment variable.
     *
     * @param string $key Variable name
     * @param mixed $default Default value if not set
     * @return mixed
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        // Check our loaded values first
        if (isset(self::$values[$key])) {
            return self::$values[$key];
        }

        // Fall back to $_ENV and getenv()
        if (isset($_ENV[$key])) {
            return $_ENV[$key];
        }

        $value = getenv($key);
        if ($value !== false) {
            return $value;
        }

        return $default;
    }

    /**
     * Get an environment variable as a boolean.
     *
     * @param string $key Variable name
     * @param bool $default Default value if not set
     * @return bool
     */
    public static function getBool(string $key, bool $default = false): bool
    {
        $value = self::get($key);

        if ($value === null) {
            return $default;
        }

        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * Get an environment variable as an integer.
     *
     * @param string $key Variable name
     * @param int $default Default value if not set
     * @return int
     */
    public static function getInt(string $key, int $default = 0): int
    {
        $value = self::get($key);

        if ($value === null || $value === '') {
            return $default;
        }

        return (int) $value;
    }

    /**
     * Check if an environment variable is set and not empty.
     *
     * @param string $key Variable name
     * @return bool
     */
    public static function has(string $key): bool
    {
        $value = self::get($key);
        return $value !== null && $value !== '';
    }

    /**
     * Get a required environment variable (throws if missing).
     *
     * @param string $key Variable name
     * @return string
     * @throws RuntimeException If variable is not set
     */
    public static function require(string $key): string
    {
        $value = self::get($key);

        if ($value === null || $value === '') {
            throw new RuntimeException("Required environment variable '$key' is not set");
        }

        return $value;
    }

    /**
     * Check if running in production environment.
     *
     * @return bool
     */
    public static function isProduction(): bool
    {
        return self::get('APP_ENV', 'production') === 'production';
    }

    /**
     * Check if running in development environment.
     *
     * @return bool
     */
    public static function isDevelopment(): bool
    {
        $env = self::get('APP_ENV', 'production');
        return in_array($env, ['development', 'dev', 'local'], true);
    }

    /**
     * Check if debug mode is enabled.
     *
     * @return bool
     */
    public static function isDebug(): bool
    {
        return self::getBool('APP_DEBUG', false);
    }
}
