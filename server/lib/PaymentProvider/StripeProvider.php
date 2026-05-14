<?php
/**
 * Stripe payment provider implementation.
 * Uses Stripe Checkout for payment processing.
 */

namespace PaymentProvider;

require_once __DIR__ . '/AbstractPaymentProvider.php';

class StripeProvider extends AbstractPaymentProvider
{
    public function getName(): string
    {
        return 'stripe';
    }

    public function isConfigured(): bool
    {
        $secretKey = $this->settings->get('stripe_secret_key', '');
        $publishableKey = $this->settings->get('stripe_publishable_key', '');

        return $secretKey !== '' && $publishableKey !== '';
    }

    private function getSecretKey(): string
    {
        return $this->settings->get('stripe_secret_key', '');
    }

    private function getWebhookSecret(): string
    {
        return $this->settings->get('stripe_webhook_secret', '');
    }

    /**
     * Make a request to Stripe API.
     */
    private function stripeRequest(string $endpoint, array $data = [], string $method = 'POST'): array
    {
        $secretKey = $this->getSecretKey();
        if (!$secretKey) {
            throw new \RuntimeException('Stripe secret key not configured');
        }

        $url = 'https://api.stripe.com/v1/' . ltrim($endpoint, '/');

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $secretKey,
                'Content-Type: application/x-www-form-urlencoded',
            ],
        ]);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
        } elseif ($method === 'GET' && !empty($data)) {
            curl_setopt($ch, CURLOPT_URL, $url . '?' . http_build_query($data));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new \RuntimeException('Stripe API request failed: ' . $error);
        }

        $decoded = json_decode($response, true);
        if (!is_array($decoded)) {
            throw new \RuntimeException('Invalid response from Stripe API');
        }

        if (isset($decoded['error'])) {
            throw new \RuntimeException('Stripe error: ' . ($decoded['error']['message'] ?? 'Unknown error'));
        }

        return $decoded;
    }

    public function createPaymentSession(array $registration, array $pricing, array $urls): array
    {
        if (!$this->isConfigured()) {
            throw new \RuntimeException('Stripe is not configured');
        }

        $amountCents = $this->dollarsToCents((float) ($pricing['totalWithProcessing'] ?? 0));
        $email = $registration['email'] ?? '';
        $name = trim(($registration['first_name'] ?? $registration['firstName'] ?? '') . ' ' .
                    ($registration['last_name'] ?? $registration['lastName'] ?? ''));

        // Create transaction record first
        $transactionId = $this->createTransaction(
            null,
            $amountCents,
            'pending',
            null,
            [
                'pricing' => $pricing,
                'customer_email' => $email,
            ]
        );

        // Build line items
        $lineItems = [
            [
                'price_data' => [
                    'currency' => 'usd',
                    'unit_amount' => $amountCents,
                    'product_data' => [
                        'name' => 'Event Registration',
                        'description' => $name ? "Registration for {$name}" : 'Event Registration',
                    ],
                ],
                'quantity' => 1,
            ],
        ];

        // Create Stripe Checkout Session
        $sessionData = [
            'payment_method_types' => ['card'],
            'mode' => 'payment',
            'success_url' => $urls['successUrl'] ?? '',
            'cancel_url' => $urls['cancelUrl'] ?? '',
            'client_reference_id' => (string) $transactionId,
            'metadata' => [
                'transaction_id' => (string) $transactionId,
            ],
        ];

        // Add line items (Stripe requires special array format)
        foreach ($lineItems as $i => $item) {
            foreach ($item as $key => $value) {
                if (is_array($value)) {
                    foreach ($value as $subKey => $subValue) {
                        if (is_array($subValue)) {
                            foreach ($subValue as $subSubKey => $subSubValue) {
                                $sessionData["line_items[{$i}][{$key}][{$subKey}][{$subSubKey}]"] = $subSubValue;
                            }
                        } else {
                            $sessionData["line_items[{$i}][{$key}][{$subKey}]"] = $subValue;
                        }
                    }
                } else {
                    $sessionData["line_items[{$i}][{$key}]"] = $value;
                }
            }
        }

        if ($email) {
            $sessionData['customer_email'] = $email;
        }

        $session = $this->stripeRequest('checkout/sessions', $sessionData);

        // Update transaction with Stripe session ID
        $this->updateTransaction(
            $transactionId,
            'pending',
            $session['id'],
            ['stripe_session_id' => $session['id']]
        );

        return [
            'id' => $session['id'],
            'url' => $session['url'],
            'transactionId' => $transactionId,
        ];
    }

    public function verifyWebhookSignature(string $payload, array $headers): bool
    {
        $secret = $this->getWebhookSecret();
        if (!$secret) {
            return false;
        }

        $signature = $headers['Stripe-Signature'] ?? $headers['stripe-signature'] ?? '';
        if (!$signature) {
            return false;
        }

        // Parse signature header
        $parts = [];
        foreach (explode(',', $signature) as $part) {
            $kv = explode('=', $part, 2);
            if (count($kv) === 2) {
                $parts[$kv[0]] = $kv[1];
            }
        }

        if (!isset($parts['t']) || !isset($parts['v1'])) {
            return false;
        }

        $timestamp = $parts['t'];
        $signedPayload = $timestamp . '.' . $payload;
        $expectedSignature = hash_hmac('sha256', $signedPayload, $secret);

        // Timing-safe comparison
        return hash_equals($expectedSignature, $parts['v1']);
    }

    public function handleWebhook(string $payload, array $headers): array
    {
        if (!$this->verifyWebhookSignature($payload, $headers)) {
            throw new \RuntimeException('Invalid webhook signature');
        }

        $event = json_decode($payload, true);
        if (!is_array($event)) {
            throw new \RuntimeException('Invalid webhook payload');
        }

        $eventType = $event['type'] ?? '';
        $data = $event['data']['object'] ?? [];

        switch ($eventType) {
            case 'checkout.session.completed':
                return $this->handleCheckoutCompleted($data);

            case 'checkout.session.expired':
                return $this->handleCheckoutExpired($data);

            case 'payment_intent.payment_failed':
                return $this->handlePaymentFailed($data);

            default:
                return [
                    'success' => true,
                    'event_type' => $eventType,
                    'action' => 'ignored',
                ];
        }
    }

    private function handleCheckoutCompleted(array $session): array
    {
        $sessionId = $session['id'] ?? '';
        $transactionId = (int) ($session['client_reference_id'] ?? $session['metadata']['transaction_id'] ?? 0);
        $paymentIntentId = $session['payment_intent'] ?? null;

        if ($transactionId > 0) {
            $this->updateTransaction(
                $transactionId,
                'completed',
                $sessionId,
                [
                    'payment_intent_id' => $paymentIntentId,
                    'completed_at' => date('Y-m-d H:i:s'),
                ]
            );

            // Update registration if linked
            $transaction = $this->getTransactionById($transactionId);
            if ($transaction && $transaction['registration_id']) {
                $this->updateRegistrationPayment(
                    (int) $transaction['registration_id'],
                    'completed',
                    $transactionId
                );
            }
        }

        return [
            'success' => true,
            'event_type' => 'checkout.session.completed',
            'transaction_id' => $transactionId,
            'session_id' => $sessionId,
        ];
    }

    private function handleCheckoutExpired(array $session): array
    {
        $sessionId = $session['id'] ?? '';
        $transactionId = (int) ($session['client_reference_id'] ?? $session['metadata']['transaction_id'] ?? 0);

        if ($transactionId > 0) {
            $this->updateTransaction($transactionId, 'expired', $sessionId);
        }

        return [
            'success' => true,
            'event_type' => 'checkout.session.expired',
            'transaction_id' => $transactionId,
        ];
    }

    private function handlePaymentFailed(array $paymentIntent): array
    {
        $paymentIntentId = $paymentIntent['id'] ?? '';

        // Find transaction by payment intent metadata if available
        $transactionId = (int) ($paymentIntent['metadata']['transaction_id'] ?? 0);

        if ($transactionId > 0) {
            $this->updateTransaction(
                $transactionId,
                'failed',
                $paymentIntentId,
                [
                    'failure_message' => $paymentIntent['last_payment_error']['message'] ?? 'Payment failed',
                ]
            );

            $transaction = $this->getTransactionById($transactionId);
            if ($transaction && $transaction['registration_id']) {
                $this->updateRegistrationPayment(
                    (int) $transaction['registration_id'],
                    'failed',
                    $transactionId
                );
            }
        }

        return [
            'success' => true,
            'event_type' => 'payment_intent.payment_failed',
            'transaction_id' => $transactionId,
        ];
    }

    public function getPaymentStatus(string $transactionId): array
    {
        $transaction = $this->getTransactionByProviderId($transactionId);

        if (!$transaction) {
            // Try to fetch from Stripe directly
            try {
                $session = $this->stripeRequest('checkout/sessions/' . $transactionId, [], 'GET');
                return [
                    'status' => $session['payment_status'] ?? 'unknown',
                    'found' => true,
                    'amount' => $this->centsToDollars((int) ($session['amount_total'] ?? 0)),
                    'currency' => strtoupper($session['currency'] ?? 'USD'),
                ];
            } catch (\Throwable $e) {
                return [
                    'status' => 'unknown',
                    'found' => false,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return [
            'status' => $transaction['status'],
            'found' => true,
            'amount' => $this->centsToDollars((int) $transaction['amount_cents']),
            'currency' => $transaction['currency'],
            'createdAt' => $transaction['created_at'],
            'completedAt' => $transaction['completed_at'],
        ];
    }

    public function getClientConfig(): array
    {
        return [
            'provider' => 'stripe',
            'publishableKey' => $this->settings->get('stripe_publishable_key', ''),
            'mode' => $this->settings->get('stripe_mode', 'test'),
        ];
    }

    public function testConnection(): array
    {
        if (!$this->isConfigured()) {
            return [
                'success' => false,
                'message' => 'Stripe credentials are not configured.',
            ];
        }

        try {
            // Test by fetching account info
            $account = $this->stripeRequest('account', [], 'GET');

            $mode = $this->settings->get('stripe_mode', 'test');
            $isLive = !($account['settings']['dashboard']['display_name'] ?? false) ||
                      strpos($this->getSecretKey(), 'sk_live_') === 0;

            return [
                'success' => true,
                'message' => 'Connected to Stripe successfully.',
                'account_id' => $account['id'] ?? null,
                'mode' => $isLive ? 'live' : 'test',
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'message' => 'Stripe connection failed: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Link a transaction to a registration.
     *
     * @param int $transactionId Transaction ID
     * @param int $registrationId Registration ID
     */
    public function linkToRegistration(int $transactionId, int $registrationId): void
    {
        $stmt = $this->pdo->prepare("
            UPDATE payment_transactions
            SET registration_id = ?
            WHERE id = ?
        ");
        $stmt->execute([$registrationId, $transactionId]);

        // Get current transaction status
        $transaction = $this->getTransactionById($transactionId);
        $status = $transaction ? $transaction['status'] : 'pending';

        $this->updateRegistrationPayment($registrationId, $status, $transactionId);
    }
}
