<?php
/**
 * Branding Service
 *
 * Loads and caches branding/theming configuration for the application.
 * Supports file-based config and database-stored settings.
 */

class BrandingService
{
    private static ?array $cache = null;
    private static ?PDO $pdo = null;

    /**
     * Set the PDO instance for database operations.
     *
     * @param PDO $pdo
     */
    public static function setDatabase(PDO $pdo): void
    {
        self::$pdo = $pdo;
    }

    /**
     * Get the complete branding configuration.
     *
     * @param bool $useCache Whether to use cached config
     * @return array Branding configuration
     */
    public static function getConfig(bool $useCache = true): array
    {
        if ($useCache && self::$cache !== null) {
            return self::$cache;
        }

        // Start with defaults
        $config = self::getDefaults();

        // Load from config file if exists
        $fileConfig = self::loadFromFile();
        if ($fileConfig) {
            $config = self::mergeConfig($config, $fileConfig);
        }

        // Load from database settings (overrides file config)
        $dbConfig = self::loadFromDatabase();
        if ($dbConfig) {
            $config = self::mergeConfig($config, $dbConfig);
        }

        self::$cache = $config;
        return $config;
    }

    /**
     * Get default branding configuration.
     *
     * @return array
     */
    public static function getDefaults(): array
    {
        return [
            'organization' => [
                'name' => 'GKP Events',
                'legalName' => '',
                'tagline' => 'Competition Registration Made Simple',
                'supportEmail' => '',
                'supportPhone' => '',
            ],
            'branding' => [
                'logo' => '/assets/images/logo.png',
                'favicon' => '/favicon.ico',
                'colors' => [
                    'primary' => '#6366f1',
                    'primaryHover' => '#4f46e5',
                    'accent' => '#f59e0b',
                    'accentHover' => '#d97706',
                    'success' => '#10b981',
                    'warning' => '#f59e0b',
                    'error' => '#ef4444',
                    'background' => '#f8fafc',
                    'surface' => '#ffffff',
                    'text' => '#111827',
                    'textMuted' => '#6b7280',
                    'headerBg' => null, // Falls back to gradient of primary colors
                    'headerText' => '#ffffff',
                    'footerBg' => '#1f2937',
                    'footerText' => '#e5e7eb',
                ],
                'fonts' => [
                    'heading' => "'Inter', system-ui, sans-serif",
                    'body' => "'Inter', system-ui, sans-serif",
                ],
                'borderRadius' => '8px',
            ],
            'terminology' => [
                'participant' => 'Participant',
                'instructor' => 'Coach',
                'group' => 'Team',
                'event' => 'Event',
                'competition' => 'Competition',
            ],
            'features' => [
                'registration' => true,
                'onlinePayment' => true,
                'manualPayment' => true,
                'multipleCoaches' => true,
                'optionalProduct' => true,
            ],
        ];
    }

    /**
     * Load branding from config file.
     *
     * @return array|null
     */
    private static function loadFromFile(): ?array
    {
        $configPath = dirname(__DIR__, 2) . '/config/tenant.json';

        if (!file_exists($configPath)) {
            return null;
        }

        $content = file_get_contents($configPath);
        $config = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("[BrandingService] Failed to parse tenant.json: " . json_last_error_msg());
            return null;
        }

        return $config;
    }

    /**
     * Load branding from database settings.
     *
     * @return array|null
     */
    private static function loadFromDatabase(): ?array
    {
        if (self::$pdo === null) {
            return null;
        }

        try {
            // Check if settings table exists
            $stmt = self::$pdo->query("SHOW TABLES LIKE 'settings'");
            if ($stmt->rowCount() === 0) {
                return null;
            }

            // Load branding-related settings
            $stmt = self::$pdo->prepare(
                "SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE 'branding_%' OR setting_key LIKE 'org_%'"
            );
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($rows)) {
                return null;
            }

            $config = [];
            foreach ($rows as $row) {
                $key = $row['setting_key'];
                $value = $row['setting_value'];

                // Try to decode JSON values
                $decoded = json_decode($value, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $value = $decoded;
                }

                // Map setting keys to config structure
                if (str_starts_with($key, 'branding_')) {
                    $configKey = substr($key, 9); // Remove 'branding_' prefix
                    $config['branding'][$configKey] = $value;
                } else if (str_starts_with($key, 'org_')) {
                    $configKey = substr($key, 4); // Remove 'org_' prefix
                    $config['organization'][$configKey] = $value;
                }
            }

            return $config;
        } catch (PDOException $e) {
            error_log("[BrandingService] Database error: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Deep merge two config arrays.
     *
     * @param array $base Base config
     * @param array $override Override config
     * @return array Merged config
     */
    private static function mergeConfig(array $base, array $override): array
    {
        foreach ($override as $key => $value) {
            if (is_array($value) && isset($base[$key]) && is_array($base[$key])) {
                $base[$key] = self::mergeConfig($base[$key], $value);
            } else {
                $base[$key] = $value;
            }
        }

        return $base;
    }

    /**
     * Generate CSS custom properties from branding config.
     *
     * @return string CSS rules
     */
    public static function generateCss(): string
    {
        $config = self::getConfig();
        $colors = $config['branding']['colors'] ?? [];
        $fonts = $config['branding']['fonts'] ?? [];

        $css = ":root {\n";

        // Color variables
        foreach ($colors as $name => $value) {
            if ($value === null) continue;

            $cssName = self::camelToKebab($name);
            $css .= "  --color-{$cssName}: {$value};\n";

            // Add RGB version for opacity support
            $rgb = self::hexToRgb($value);
            if ($rgb) {
                $css .= "  --color-{$cssName}-rgb: {$rgb};\n";
            }
        }

        // Font variables
        foreach ($fonts as $name => $value) {
            if ($value === null) continue;
            $cssName = self::camelToKebab($name);
            $css .= "  --font-{$cssName}: {$value};\n";
        }

        // Border radius
        if (isset($config['branding']['borderRadius'])) {
            $css .= "  --border-radius: {$config['branding']['borderRadius']};\n";
        }

        $css .= "}\n";

        return $css;
    }

    /**
     * Get a specific branding value.
     *
     * @param string $path Dot-notation path (e.g., 'colors.primary')
     * @param mixed $default Default value
     * @return mixed
     */
    public static function get(string $path, mixed $default = null): mixed
    {
        $config = self::getConfig();
        $keys = explode('.', $path);

        foreach ($keys as $key) {
            if (!is_array($config) || !array_key_exists($key, $config)) {
                return $default;
            }
            $config = $config[$key];
        }

        return $config;
    }

    /**
     * Get terminology for a concept.
     *
     * @param string $key Term key
     * @param string|null $default Default value
     * @return string
     */
    public static function term(string $key, ?string $default = null): string
    {
        return self::get("terminology.$key", $default ?? ucfirst($key));
    }

    /**
     * Check if a feature is enabled.
     *
     * @param string $feature Feature key
     * @param bool $default Default value
     * @return bool
     */
    public static function featureEnabled(string $feature, bool $default = false): bool
    {
        return (bool) self::get("features.$feature", $default);
    }

    /**
     * Clear the config cache.
     */
    public static function clearCache(): void
    {
        self::$cache = null;
    }

    /**
     * Convert camelCase to kebab-case.
     *
     * @param string $string
     * @return string
     */
    private static function camelToKebab(string $string): string
    {
        return strtolower(preg_replace('/([a-z])([A-Z])/', '$1-$2', $string));
    }

    /**
     * Convert hex color to RGB values string.
     *
     * @param string $hex Hex color code
     * @return string|null "r, g, b" or null if invalid
     */
    private static function hexToRgb(string $hex): ?string
    {
        $hex = ltrim($hex, '#');

        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }

        if (strlen($hex) !== 6) {
            return null;
        }

        $r = hexdec(substr($hex, 0, 2));
        $g = hexdec(substr($hex, 2, 2));
        $b = hexdec(substr($hex, 4, 2));

        return "$r, $g, $b";
    }
}
