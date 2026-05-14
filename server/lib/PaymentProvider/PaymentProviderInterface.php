<?php
/**
 * Interface for payment provider implementations.
 * All payment providers (Stripe, PayPal, Square, Manual) must implement this interface.
 */

namespace PaymentProvider;

interface PaymentProviderInterface
{
    /**
     * Get the provider identifier.
     *
     * @return string Provider name (e.g., 'stripe', 'paypal', 'square', 'manual')
     */
    public function getName(): string;

    /**
     * Check if the provider is properly configured.
     *
     * @return bool True if all required credentials are set
     */
    public function isConfigured(): bool;

    /**
     * Create a payment session/checkout.
     *
     * @param array $registration Registration data
     * @param array $pricing Computed pricing (subtotal, fees, total, etc.)
     * @param array $urls Success/cancel URLs for redirects
     * @return array Result with 'url' for redirect or 'id' for session
     * @throws \Exception on failure
     */
    public function createPaymentSession(array $registration, array $pricing, array $urls): array;

    /**
     * Verify webhook signature.
     *
     * @param string $payload Raw webhook payload
     * @param array $headers Request headers
     * @return bool True if signature is valid
     */
    public function verifyWebhookSignature(string $payload, array $headers): bool;

    /**
     * Handle webhook event.
     *
     * @param string $payload Raw webhook payload
     * @param array $headers Request headers
     * @return array Result with 'success', 'event_type', 'data'
     * @throws \Exception on failure
     */
    public function handleWebhook(string $payload, array $headers): array;

    /**
     * Get payment status from provider.
     *
     * @param string $transactionId Provider's transaction/session ID
     * @return array Status info ('status', 'amount', 'metadata', etc.)
     */
    public function getPaymentStatus(string $transactionId): array;

    /**
     * Get client-side configuration (public keys, etc.).
     *
     * @return array Public configuration safe to send to frontend
     */
    public function getClientConfig(): array;

    /**
     * Test the connection/credentials.
     *
     * @return array Result with 'success' and 'message'
     */
    public function testConnection(): array;
}
