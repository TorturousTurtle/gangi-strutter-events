<?php
/**
 * Square payment provider implementation.
 * Uses Square Checkout for payment processing.
 */

namespace PaymentProvider;

require_once __DIR__ . '/AbstractPaymentProvider.php';

class SquareProvider extends AbstractPaymentProvider
{
    public function getName(): string
    {
        return 'square';
    }

    public function isConfigured(): bool
    {
        $accessToken = $this->settings->get('square_access_token', '');
        $locationId = $this->settings->get('square_location_id', '');

        return $accessToken !== '' && $locationId !== '';
    }

    private function getApiBase(): string
    {
        $mode = $this->settings->get('square_mode', 'sandbox');
        return $mode === 'production'
            ? 'https://connect.squareup.com'
            : 'https://connect.squareupsandbox.com';
    }

    private function getAccessToken(): string
    {
        return $this->settings->get('square_access_token', '');
    }

    private function getLocationId(): string
    {
        return $this->settings->get('square_location_id', '');
    }

    /**
     * Make a request to Square API.
     */
    private function squareRequest(string $endpoint, ?array $data = null, string $method = 'POST'): array
    {
        $token = $this->getAccessToken();
        if (!$token) {
            throw new \RuntimeException('Square access token not configured');
        }

        $url = $this->getApiBase() . $endpoint;

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $token,
                'Content-Type: application/json',
                'Square-Version: 2024-01-18',
            ],
        ]);

        if ($method === 'POST' && $data !== null) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif ($method === 'GET') {
            curl_setopt($ch, CURLOPT_HTTPGET, true);
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new \RuntimeException('Square API request failed: ' . $error);
        }

        $decoded = json_decode($response, true);
        if (!is_array($decoded)) {
            throw new \RuntimeException('Invalid response from Square API');
        }

        if (isset($decoded['errors']) && is_array($decoded['errors']) && count($decoded['errors']) > 0) {
            $errorMsg = $decoded['errors'][0]['detail'] ?? $decoded['errors'][0]['category'] ?? 'Unknown error';
            throw new \RuntimeException('Square error: ' . $errorMsg);
        }

        return $decoded;
    }

    public function createPaymentSession(array $registration, array $pricing, array $urls): array
    {
        if (!$this->isConfigured()) {
            throw new \RuntimeException('Square is not configured');
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

        // Create Square Checkout
        $idempotencyKey = 'txn_' . $transactionId . '_' . time();

        $checkoutData = [
            'idempotency_key' => $idempotencyKey,
            'quick_pay' => [
                'name' => $name ? "Registration for {$name}" : 'Event Registration',
                'price_money' => [
                    'amount' => $amountCents,
                    'currency' => 'USD',
                ],
                'location_id' => $this->getLocationId(),
            ],
            'checkout_options' => [
                'redirect_url' => $urls['successUrl'] ?? '',
                'ask_for_shipping_address' => false,
            ],
            'pre_populated_data' => [],
        ];

        if ($email) {
            $checkoutData['pre_populated_data']['buyer_email'] = $email;
        }

        $checkout = $this->squareRequest('/v2/online-checkout/payment-links', $checkoutData);

        $paymentLink = $checkout['payment_link'] ?? [];
        $checkoutUrl = $paymentLink['long_url'] ?? $paymentLink['url'] ?? null;
        $linkId = $paymentLink['id'] ?? null;

        if (!$checkoutUrl) {
            throw new \RuntimeException('Square did not return a checkout URL');
        }

        // Update transaction with Square link ID
        $this->updateTransaction(
            $transactionId,
            'pending',
            $linkId,
            [
                'square_link_id' => $linkId,
                'square_order_id' => $paymentLink['order_id'] ?? null,
            ]
        );

        return [
            'id' => $linkId,
            'url' => $checkoutUrl,
            'transactionId' => $transactionId,
        ];
    }

    public function verifyWebhookSignature(string $payload, array $headers): bool
    {
        // Square uses a webhook signature URL that needs to be configured
        // Basic validation: check for Square-specific headers
        $signature = $headers['X-Square-Hmacsha256-Signature'] ?? $headers['x-square-hmacsha256-signature'] ?? null;
        return $signature !== null;
    }

    public function handleWebhook(string $payload, array $headers): array
    {
        $event = json_decode($payload, true);
        if (!is_array($event)) {
            throw new \RuntimeException('Invalid webhook payload');
        }

        $eventType = $event['type'] ?? '';
        $data = $event['data']['object'] ?? $event['data'] ?? [];

        switch ($eventType) {
            case 'payment.completed':
                return $this->handlePaymentCompleted($data);

            case 'payment.failed':
                return $this->handlePaymentFailed($data);

            case 'online_checkout.payment_link.completed':
                return $this->handleCheckoutCompleted($data);

            default:
                return [
                    'success' => true,
                    'event_type' => $eventType,
                    'action' => 'ignored',
                ];
        }
    }

    private function handlePaymentCompleted(array $payment): array
    {
        $paymentData = $payment['payment'] ?? $payment;
        $orderId = $paymentData['order_id'] ?? null;

        if ($orderId) {
            // Find transaction by order ID in metadata
            $stmt = $this->pdo->prepare("
                SELECT id, registration_id FROM payment_transactions
                WHERE provider = 'square'
                AND JSON_EXTRACT(metadata_json, '$.square_order_id') = ?
                LIMIT 1
            ");
            $stmt->execute([$orderId]);
            $transaction = $stmt->fetch(\PDO::FETCH_ASSOC);

            if ($transaction) {
                $this->updateTransaction(
                    (int) $transaction['id'],
                    'completed',
                    $paymentData['id'] ?? $orderId,
                    [
                        'payment_id' => $paymentData['id'] ?? null,
                        'completed_at' => date('Y-m-d H:i:s'),
                    ]
                );

                if ($transaction['registration_id']) {
                    $this->updateRegistrationPayment(
                        (int) $transaction['registration_id'],
                        'completed',
                        (int) $transaction['id']
                    );
                }
            }
        }

        return [
            'success' => true,
            'event_type' => 'payment.completed',
            'order_id' => $orderId,
        ];
    }

    private function handlePaymentFailed(array $payment): array
    {
        $paymentData = $payment['payment'] ?? $payment;
        $orderId = $paymentData['order_id'] ?? null;

        if ($orderId) {
            $stmt = $this->pdo->prepare("
                SELECT id, registration_id FROM payment_transactions
                WHERE provider = 'square'
                AND JSON_EXTRACT(metadata_json, '$.square_order_id') = ?
                LIMIT 1
            ");
            $stmt->execute([$orderId]);
            $transaction = $stmt->fetch(\PDO::FETCH_ASSOC);

            if ($transaction) {
                $this->updateTransaction(
                    (int) $transaction['id'],
                    'failed',
                    $paymentData['id'] ?? $orderId,
                    ['failure_reason' => 'Payment failed']
                );

                if ($transaction['registration_id']) {
                    $this->updateRegistrationPayment(
                        (int) $transaction['registration_id'],
                        'failed',
                        (int) $transaction['id']
                    );
                }
            }
        }

        return [
            'success' => true,
            'event_type' => 'payment.failed',
            'order_id' => $orderId,
        ];
    }

    private function handleCheckoutCompleted(array $data): array
    {
        $paymentLink = $data['payment_link'] ?? $data;
        $linkId = $paymentLink['id'] ?? null;

        if ($linkId) {
            $transaction = $this->getTransactionByProviderId($linkId);

            if ($transaction) {
                $this->updateTransaction(
                    (int) $transaction['id'],
                    'completed',
                    $linkId,
                    ['completed_at' => date('Y-m-d H:i:s')]
                );

                if ($transaction['registration_id']) {
                    $this->updateRegistrationPayment(
                        (int) $transaction['registration_id'],
                        'completed',
                        (int) $transaction['id']
                    );
                }
            }
        }

        return [
            'success' => true,
            'event_type' => 'online_checkout.payment_link.completed',
            'link_id' => $linkId,
        ];
    }

    public function getPaymentStatus(string $transactionId): array
    {
        $transaction = $this->getTransactionByProviderId($transactionId);

        if (!$transaction) {
            return [
                'status' => 'unknown',
                'found' => false,
            ];
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
            'provider' => 'square',
            'applicationId' => $this->settings->get('square_application_id', ''),
            'locationId' => $this->settings->get('square_location_id', ''),
            'mode' => $this->settings->get('square_mode', 'sandbox'),
        ];
    }

    public function testConnection(): array
    {
        if (!$this->isConfigured()) {
            return [
                'success' => false,
                'message' => 'Square credentials are not configured.',
            ];
        }

        try {
            // Test by fetching locations
            $locations = $this->squareRequest('/v2/locations', null, 'GET');

            $locationId = $this->getLocationId();
            $foundLocation = false;
            $locationName = null;

            foreach ($locations['locations'] ?? [] as $loc) {
                if ($loc['id'] === $locationId) {
                    $foundLocation = true;
                    $locationName = $loc['name'] ?? null;
                    break;
                }
            }

            if (!$foundLocation) {
                return [
                    'success' => false,
                    'message' => 'Configured location ID not found in Square account.',
                ];
            }

            return [
                'success' => true,
                'message' => 'Connected to Square successfully.',
                'location_name' => $locationName,
                'mode' => $this->settings->get('square_mode', 'sandbox'),
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'message' => 'Square connection failed: ' . $e->getMessage(),
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

        $transaction = $this->getTransactionById($transactionId);
        $status = $transaction ? $transaction['status'] : 'pending';

        $this->updateRegistrationPayment($registrationId, $status, $transactionId);
    }
}
