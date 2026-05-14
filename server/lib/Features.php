<?php
/**
 * Feature Flags Manager
 *
 * Provides runtime access to feature toggles defined in config/features.json.
 * Supports dot notation for nested flags (e.g., 'registration.enabled').
 */

class Features
{
    private static ?array $features = null;
    private static string $configPath;

    /**
     * Load feature flags from JSON config file.
     *
     * @param string|null $path Path to features.json (defaults to config/features.json)
     * @return void
     */
    public static function load(?string $path = null): void
    {
        self::$configPath = $path ?? dirname(__DIR__, 2) . '/config/features.json';

        if (!file_exists(self::$configPath)) {
            self::$features = [];
            return;
        }

        $json = file_get_contents(self::$configPath);
        $decoded = json_decode($json, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new RuntimeException(
                "Failed to parse features.json: " . json_last_error_msg()
            );
        }

        self::$features = $decoded ?? [];
    }

    /**
     * Ensure features are loaded.
     */
    private static function ensureLoaded(): void
    {
        if (self::$features === null) {
            self::load();
        }
    }

    /**
     * Check if a feature is enabled.
     *
     * @param string $key Feature key using dot notation (e.g., 'registration.enabled')
     * @param bool $default Default value if feature is not defined
     * @return bool
     */
    public static function enabled(string $key, bool $default = false): bool
    {
        return (bool) self::get($key, $default);
    }

    /**
     * Check if a feature is disabled.
     *
     * @param string $key Feature key using dot notation
     * @param bool $default Default value if feature is not defined
     * @return bool
     */
    public static function disabled(string $key, bool $default = true): bool
    {
        return !self::enabled($key, !$default);
    }

    /**
     * Get a feature flag value.
     *
     * @param string $key Feature key using dot notation
     * @param mixed $default Default value if not found
     * @return mixed
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        self::ensureLoaded();

        $keys = explode('.', $key);
        $value = self::$features;

        foreach ($keys as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return $default;
            }
            $value = $value[$segment];
        }

        return $value;
    }

    /**
     * Get all features in a category.
     *
     * @param string $category Category name (e.g., 'registration', 'admin')
     * @return array
     */
    public static function category(string $category): array
    {
        self::ensureLoaded();
        return self::$features[$category] ?? [];
    }

    /**
     * Get all feature flags.
     *
     * @return array
     */
    public static function all(): array
    {
        self::ensureLoaded();
        return self::$features;
    }

    /**
     * Check multiple features at once (all must be enabled).
     *
     * @param array $keys Array of feature keys
     * @return bool True if ALL features are enabled
     */
    public static function allEnabled(array $keys): bool
    {
        foreach ($keys as $key) {
            if (!self::enabled($key)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Check if any of the given features are enabled.
     *
     * @param array $keys Array of feature keys
     * @return bool True if ANY feature is enabled
     */
    public static function anyEnabled(array $keys): bool
    {
        foreach ($keys as $key) {
            if (self::enabled($key)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Override a feature flag at runtime (useful for testing).
     *
     * @param string $key Feature key using dot notation
     * @param mixed $value New value
     * @return void
     */
    public static function override(string $key, mixed $value): void
    {
        self::ensureLoaded();

        $keys = explode('.', $key);
        $lastKey = array_pop($keys);
        $current = &self::$features;

        foreach ($keys as $segment) {
            if (!isset($current[$segment]) || !is_array($current[$segment])) {
                $current[$segment] = [];
            }
            $current = &$current[$segment];
        }

        $current[$lastKey] = $value;
    }

    /**
     * Reset loaded features (useful for testing).
     *
     * @return void
     */
    public static function reset(): void
    {
        self::$features = null;
    }
}
