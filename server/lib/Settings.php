<?php
/**
 * Settings manager for reading/writing application settings from the database.
 * Supports encrypted storage for sensitive values (e.g., API keys).
 */

require_once __DIR__ . '/Encryption.php';

class Settings
{
    private PDO $pdo;
    private ?Encryption $encryption = null;
    private array $cache = [];
    private bool $cacheLoaded = false;

    /**
     * Keys that should be stored encrypted.
     */
    private const ENCRYPTED_KEYS = [
        'stripe_secret_key',
        'stripe_webhook_secret',
        'paypal_client_secret',
        'square_access_token',
    ];

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Get the Encryption instance (lazy-loaded).
     */
    private function getEncryption(): Encryption
    {
        if ($this->encryption === null) {
            $this->encryption = new Encryption();
        }
        return $this->encryption;
    }

    /**
     * Check if a key should be stored encrypted.
     */
    private function shouldEncrypt(string $key): bool
    {
        return in_array($key, self::ENCRYPTED_KEYS, true);
    }

    /**
     * Load all settings into cache.
     */
    private function loadCache(): void
    {
        if ($this->cacheLoaded) {
            return;
        }

        try {
            $stmt = $this->pdo->query("SELECT setting_key, setting_value, setting_value_encrypted, is_encrypted FROM settings");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($rows as $row) {
                $key = $row['setting_key'];
                if ($row['is_encrypted'] && $row['setting_value_encrypted'] !== null) {
                    try {
                        $this->cache[$key] = $this->getEncryption()->decrypt($row['setting_value_encrypted']);
                    } catch (Throwable $e) {
                        // Decryption failed - treat as null
                        $this->cache[$key] = null;
                    }
                } else {
                    $this->cache[$key] = $row['setting_value'];
                }
            }

            $this->cacheLoaded = true;
        } catch (PDOException $e) {
            // Table might not exist yet
            $this->cacheLoaded = true;
        }
    }

    /**
     * Clear the internal cache.
     */
    public function clearCache(): void
    {
        $this->cache = [];
        $this->cacheLoaded = false;
    }

    /**
     * Get a setting value.
     *
     * @param string $key Setting key
     * @param mixed $default Default value if not set
     * @return mixed
     */
    public function get(string $key, mixed $default = null): mixed
    {
        $this->loadCache();
        return array_key_exists($key, $this->cache) ? $this->cache[$key] : $default;
    }

    /**
     * Get a setting value as a boolean.
     */
    public function getBool(string $key, bool $default = false): bool
    {
        $value = $this->get($key);
        if ($value === null) {
            return $default;
        }
        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * Get a setting value as an integer.
     */
    public function getInt(string $key, int $default = 0): int
    {
        $value = $this->get($key);
        if ($value === null || $value === '') {
            return $default;
        }
        return (int) $value;
    }

    /**
     * Set a setting value.
     *
     * @param string $key Setting key
     * @param mixed $value Value to store (null to delete)
     * @param string $category Optional category for grouping
     */
    public function set(string $key, mixed $value, string $category = 'general'): void
    {
        $isEncrypted = $this->shouldEncrypt($key);

        if ($value === null) {
            // Delete the setting
            $stmt = $this->pdo->prepare("DELETE FROM settings WHERE setting_key = ?");
            $stmt->execute([$key]);
            unset($this->cache[$key]);
            return;
        }

        $stringValue = is_string($value) ? $value : json_encode($value);

        if ($isEncrypted) {
            $encryptedValue = $this->getEncryption()->encrypt($stringValue);
            $stmt = $this->pdo->prepare("
                INSERT INTO settings (setting_key, setting_value, setting_value_encrypted, is_encrypted, category)
                VALUES (?, NULL, ?, 1, ?)
                ON DUPLICATE KEY UPDATE
                    setting_value = NULL,
                    setting_value_encrypted = VALUES(setting_value_encrypted),
                    is_encrypted = 1,
                    category = VALUES(category),
                    updated_at = CURRENT_TIMESTAMP
            ");
            $stmt->execute([$key, $encryptedValue, $category]);
        } else {
            $stmt = $this->pdo->prepare("
                INSERT INTO settings (setting_key, setting_value, setting_value_encrypted, is_encrypted, category)
                VALUES (?, ?, NULL, 0, ?)
                ON DUPLICATE KEY UPDATE
                    setting_value = VALUES(setting_value),
                    setting_value_encrypted = NULL,
                    is_encrypted = 0,
                    category = VALUES(category),
                    updated_at = CURRENT_TIMESTAMP
            ");
            $stmt->execute([$key, $stringValue, $category]);
        }

        $this->cache[$key] = $stringValue;
    }

    /**
     * Get all settings for a category.
     *
     * @param string $category Category name
     * @return array Key-value pairs
     */
    public function getByCategory(string $category): array
    {
        $this->loadCache();

        $stmt = $this->pdo->prepare("SELECT setting_key FROM settings WHERE category = ?");
        $stmt->execute([$category]);
        $keys = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $result = [];
        foreach ($keys as $key) {
            if (array_key_exists($key, $this->cache)) {
                $result[$key] = $this->cache[$key];
            }
        }
        return $result;
    }

    /**
     * Delete all settings for a category.
     *
     * @param string $category Category name
     */
    public function deleteByCategory(string $category): void
    {
        $stmt = $this->pdo->prepare("DELETE FROM settings WHERE category = ?");
        $stmt->execute([$category]);
        $this->clearCache();
    }

    /**
     * Get payment provider configuration (public-safe data only).
     * Does NOT return secret keys.
     */
    public function getPaymentConfig(): array
    {
        $provider = $this->get('payment_provider', 'none');
        $payLaterEnabled = $this->getBool('pay_later_enabled', false);
        $payLaterInstructions = $this->get('pay_later_instructions', '');

        $config = [
            'provider' => $provider,
            'payLaterEnabled' => $payLaterEnabled,
            'payLaterInstructions' => $payLaterInstructions,
        ];

        // Add provider-specific public config
        switch ($provider) {
            case 'stripe':
                $config['stripePublishableKey'] = $this->get('stripe_publishable_key', '');
                $config['stripeMode'] = $this->get('stripe_mode', 'test');
                break;

            case 'paypal':
                $config['paypalClientId'] = $this->get('paypal_client_id', '');
                $config['paypalMode'] = $this->get('paypal_mode', 'sandbox');
                break;

            case 'square':
                $config['squareApplicationId'] = $this->get('square_application_id', '');
                $config['squareLocationId'] = $this->get('square_location_id', '');
                $config['squareMode'] = $this->get('square_mode', 'sandbox');
                break;
        }

        return $config;
    }

    /**
     * Check if the settings table exists.
     */
    public function tableExists(): bool
    {
        try {
            $stmt = $this->pdo->query("SHOW TABLES LIKE 'settings'");
            return (bool) $stmt->fetch();
        } catch (PDOException $e) {
            return false;
        }
    }

    /**
     * Get branding configuration for frontend use.
     * Returns all public branding settings.
     */
    public function getBrandingConfig(): array
    {
        return [
            'organizationName' => $this->get('brand_organization_name', 'GKP Events'),
            'tagline' => $this->get('brand_tagline', 'Competition Registration Made Simple'),
            'primaryColor' => $this->get('brand_primary_color', '#6366f1'),
            'secondaryColor' => $this->get('brand_secondary_color', '#f59e0b'),
            'logoUrl' => $this->get('brand_logo_url', ''),
            'logoDarkUrl' => $this->get('brand_logo_dark_url', ''),
            'faviconUrl' => $this->get('brand_favicon_url', ''),
            'headerStyle' => $this->get('brand_header_style', 'gradient'),
            'footerText' => $this->get('brand_footer_text', ''),
        ];
    }

    /**
     * Save branding configuration.
     *
     * @param array $data Branding settings
     */
    public function saveBrandingConfig(array $data): void
    {
        $mappings = [
            'organizationName' => 'brand_organization_name',
            'tagline' => 'brand_tagline',
            'primaryColor' => 'brand_primary_color',
            'secondaryColor' => 'brand_secondary_color',
            'logoUrl' => 'brand_logo_url',
            'logoDarkUrl' => 'brand_logo_dark_url',
            'faviconUrl' => 'brand_favicon_url',
            'headerStyle' => 'brand_header_style',
            'footerText' => 'brand_footer_text',
        ];

        foreach ($mappings as $inputKey => $settingKey) {
            if (array_key_exists($inputKey, $data)) {
                $this->set($settingKey, $data[$inputKey], 'branding');
            }
        }
    }

    /**
     * Validate a hex color code.
     */
    public static function isValidHexColor(string $color): bool
    {
        return (bool) preg_match('/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/', $color);
    }

    /**
     * Convert hex color to RGB array.
     */
    public static function hexToRgb(string $hex): ?array
    {
        $hex = ltrim($hex, '#');

        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }

        if (strlen($hex) !== 6) {
            return null;
        }

        return [
            'r' => hexdec(substr($hex, 0, 2)),
            'g' => hexdec(substr($hex, 2, 2)),
            'b' => hexdec(substr($hex, 4, 2)),
        ];
    }

    /**
     * Generate CSS custom properties from branding config.
     */
    public function generateBrandingCSS(): string
    {
        $config = $this->getBrandingConfig();

        $primaryRgb = self::hexToRgb($config['primaryColor']);
        $secondaryRgb = self::hexToRgb($config['secondaryColor']);

        $css = ":root {\n";

        // Primary color
        if ($primaryRgb) {
            $css .= "  --brand-primary: {$config['primaryColor']};\n";
            $css .= "  --brand-primary-rgb: {$primaryRgb['r']}, {$primaryRgb['g']}, {$primaryRgb['b']};\n";

            // Generate hover (10% darker)
            $hoverR = max(0, $primaryRgb['r'] - 25);
            $hoverG = max(0, $primaryRgb['g'] - 25);
            $hoverB = max(0, $primaryRgb['b'] - 25);
            $hoverHex = sprintf('#%02x%02x%02x', $hoverR, $hoverG, $hoverB);
            $css .= "  --brand-primary-hover: {$hoverHex};\n";

            // Generate light (10% opacity)
            $css .= "  --brand-primary-light: rgba({$primaryRgb['r']}, {$primaryRgb['g']}, {$primaryRgb['b']}, 0.1);\n";
        }

        // Secondary color
        if ($secondaryRgb) {
            $css .= "  --brand-secondary: {$config['secondaryColor']};\n";
            $css .= "  --brand-secondary-rgb: {$secondaryRgb['r']}, {$secondaryRgb['g']}, {$secondaryRgb['b']};\n";

            // Generate hover (10% darker)
            $hoverR = max(0, $secondaryRgb['r'] - 25);
            $hoverG = max(0, $secondaryRgb['g'] - 25);
            $hoverB = max(0, $secondaryRgb['b'] - 25);
            $hoverHex = sprintf('#%02x%02x%02x', $hoverR, $hoverG, $hoverB);
            $css .= "  --brand-secondary-hover: {$hoverHex};\n";

            // Generate light (10% opacity)
            $css .= "  --brand-secondary-light: rgba({$secondaryRgb['r']}, {$secondaryRgb['g']}, {$secondaryRgb['b']}, 0.1);\n";
        }

        $css .= "}\n";

        return $css;
    }
}
