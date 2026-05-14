<?php
/**
 * Factory for creating payment provider instances.
 */

namespace PaymentProvider;

require_once __DIR__ . '/PaymentProviderInterface.php';
require_once __DIR__ . '/StripeProvider.php';
require_once __DIR__ . '/PayPalProvider.php';
require_once __DIR__ . '/SquareProvider.php';
require_once __DIR__ . '/ManualProvider.php';
require_once __DIR__ . '/../Settings.php';

class PaymentProviderFactory
{
    private \Settings $settings;
    private \PDO $pdo;

    public function __construct(\Settings $settings, \PDO $pdo)
    {
        $this->settings = $settings;
        $this->pdo = $pdo;
    }

    /**
     * Get the currently configured active payment provider.
     *
     * @return PaymentProviderInterface|null Provider instance or null if none configured
     */
    public function getActiveProvider(): ?PaymentProviderInterface
    {
        $providerName = $this->settings->get('payment_provider', 'none');
        return $this->getProvider($providerName);
    }

    /**
     * Get a specific payment provider by name.
     *
     * @param string $name Provider name (stripe, paypal, square, manual)
     * @return PaymentProviderInterface|null Provider instance or null if invalid
     */
    public function getProvider(string $name): ?PaymentProviderInterface
    {
        switch ($name) {
            case 'stripe':
                return new StripeProvider($this->settings, $this->pdo);

            case 'paypal':
                return new PayPalProvider($this->settings, $this->pdo);

            case 'square':
                return new SquareProvider($this->settings, $this->pdo);

            case 'manual':
                return new ManualProvider($this->settings, $this->pdo);

            case 'none':
            case '':
                return null;

            default:
                return null;
        }
    }

    /**
     * Get the manual (Pay Later) provider if enabled.
     *
     * @return ManualProvider|null Provider instance or null if not enabled
     */
    public function getManualProvider(): ?ManualProvider
    {
        if (!$this->settings->getBool('pay_later_enabled', false)) {
            return null;
        }
        return new ManualProvider($this->settings, $this->pdo);
    }

    /**
     * Get all available provider names.
     *
     * @return array List of provider names
     */
    public static function getAvailableProviders(): array
    {
        return ['stripe', 'paypal', 'square', 'manual', 'none'];
    }

    /**
     * Get provider display names for UI.
     *
     * @return array Provider name => display name
     */
    public static function getProviderDisplayNames(): array
    {
        return [
            'none' => 'None (No payments)',
            'stripe' => 'Stripe',
            'paypal' => 'PayPal',
            'square' => 'Square',
            'manual' => 'Pay Later (Manual)',
        ];
    }

    /**
     * Check if the active provider is properly configured.
     *
     * @return bool True if active provider is configured (or no provider is set)
     */
    public function isActiveProviderConfigured(): bool
    {
        $provider = $this->getActiveProvider();
        if ($provider === null) {
            // No provider set is considered "configured" (payments disabled)
            return true;
        }
        return $provider->isConfigured();
    }

    /**
     * Get configuration status for all providers.
     *
     * @return array Provider name => ['configured' => bool, 'active' => bool]
     */
    public function getAllProviderStatus(): array
    {
        $activeProvider = $this->settings->get('payment_provider', 'none');

        $status = [];
        foreach (['stripe', 'paypal', 'square'] as $name) {
            $provider = $this->getProvider($name);
            $status[$name] = [
                'configured' => $provider ? $provider->isConfigured() : false,
                'active' => $name === $activeProvider,
            ];
        }

        // Pay Later is special
        $status['manual'] = [
            'configured' => $this->settings->getBool('pay_later_enabled', false),
            'active' => false, // Manual is secondary, not "the" active provider
        ];

        return $status;
    }
}
