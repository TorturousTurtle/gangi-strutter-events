<?php
/**
 * PayPal payment provider implementation.
 * Uses PayPal Checkout for payment processing.
 */

namespace PaymentProvider;

require_once __DIR__ . '/AbstractPaymentProvider.php';

class PayPalProvider extends AbstractPaymentProvider
{
    private ?string $accessToken = null;
    private ?int $tokenExpiry = null;

    public function getName(): string
    {
        return 'paypal';
    }

    public function isConfigured(): bool
    {
        $clientId = $this->settings->get('paypal_client_id', '');
        $clientSecret = $this->settings->get('paypal_client_secret', '');

        return $clientId !== '' && $clientSecret !== '';
    }

    private function getApiBase(): string
    {
        $mode = $this->settings->get('paypal_mode', 'sandbox');
        return $mode === 'live'
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';
    }

    /**
     * Get OAuth access token for PayPal API.
     */
    private function getAccessToken(): string
    {
        // Return cached token if still valid
        if ($this->accessToken && $this->tokenExpiry && time() < $this->tokenExpiry) {
            return $this->accessToken;
        }

        $clientId = $this->settings->get('paypal_client_id', '');
        $clientSecret = $this->settings->get('paypal_client_secret', '');

        if (!$clientId || !$clientSecret) {
            throw new \RuntimeException('PayPal credentials not configured');
        }

        $ch = curl_init($this->getApiBase() . '/v1/oauth2/token');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => 'grant_type=client_credentials',
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'Accept-Language: en_US',
            ],
            CURLOPT_USERPWD => $clientId . ':' . $clientSecret,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new \RuntimeException('PayPal OAuth request failed: ' . $error);
        }

        $decoded = json_decode($response, true);
        if (!is_array($decoded) || !isset($decoded['access_token'])) {
            throw new \RuntimeException('Invalid OAuth response from PayPal');
        }

        $this->accessToken = $decoded['access_token'];
        $this->tokenExpiry = time() + (int) ($decoded['expires_in'] ?? 3600) - 60; // Refresh 1 min early

        return $this->accessToken;
    }

    /**
     * Make a request to PayPal API.
     */
    private function paypalRequest(string $endpoint, ?array $data = null, string $method = 'POST'): array
    {
        $token = $this->getAccessToken();
        $url = $this->getApiBase() . $endpoint;

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $token,
                'Content-Type: application/json',
                'PayPal-Request-Id: ' . uniqid('req_', true),
            ],
        ]);

        if ($method === 'POST' && $data !== null) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif ($method === 'GET') {
            curl_setopt($ch, CURLOPT_HTTPGET, true);
        } elseif ($method === 'PATCH' && $data !== null) {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new \RuntimeException('PayPal API request failed: ' . $error);
        }

        // Handle empty response (204 No Content)
        if ($response === '' && $httpCode >= 200 && $httpCode < 300) {
            return ['status' => 'success'];
        }

        $decoded = json_decode($response, true);
        if (!is_array($decoded)) {
            throw new \RuntimeException('Invalid response from PayPal API');
        }

        if ($httpCode >= 400) {
            $errorMsg = $decoded['message'] ?? $decoded['error_description'] ?? 'Unknown error';
            throw new \RuntimeException('PayPal error: ' . $errorMsg);
        }

        return $decoded;
    }

    public function createPaymentSession(array $registration, array $pricing, array $urls): array
    {
        if (!$this->isConfigured()) {
            throw new \RuntimeException('PayPal is not configured');
        }

        $amount = number_format((float) ($pricing['totalWithProcessing'] ?? 0), 2, '.', '');
        $amountCents = $this->dollarsToCents((float) $amount);

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

        // Create PayPal order
        $orderData = [
            'intent' => 'CAPTURE',
            'purchase_units' => [
                [
                    'reference_id' => (string) $transactionId,
                    'description' => $name ? "Registration for {$name}" : 'Event Registration',
                    'amount' => [
                        'currency_code' => 'USD',
                        'value' => $amount,
                    ],
                ],
            ],
            'application_context' => [
                'brand_name' => 'Event Registration',
                'landing_page' => 'BILLING',
                'user_action' => 'PAY_NOW',
                'return_url' => $urls['successUrl'] ?? '',
                'cancel_url' => $urls['cancelUrl'] ?? '',
            ],
        ];

        $order = $this->paypalRequest('/v2/checkout/orders', $orderData);

        // Find approval link
        $approvalUrl = null;
        foreach ($order['links'] ?? [] as $link) {
            if ($link['rel'] === 'approve') {
                $approvalUrl = $link['href'];
                break;
            }
        }

        if (!$approvalUrl) {
            throw new \RuntimeException('PayPal did not return an approval URL');
        }

        // Update transaction with PayPal order ID
        $this->updateTransaction(
            $transactionId,
            'pending',
            $order['id'],
            ['paypal_order_id' => $order['id']]
        );

        return [
            'id' => $order['id'],
            'url' => $approvalUrl,
            'transactionId' => $transactionId,
        ];
    }

    public function verifyWebhookSignature(string $payload, array $headers): bool
    {
        // PayPal webhook verification requires the webhook ID configured in PayPal dashboard
        // For now, we'll do basic validation
        $webhookId = $headers['PAYPAL-TRANSMISSION-ID'] ?? $headers['paypal-transmission-id'] ?? null;
        return $webhookId !== null;
    }

    public function handleWebhook(string $payload, array $headers): array
    {
        $event = json_decode($payload, true);
        if (!is_array($event)) {
            throw new \RuntimeException('Invalid webhook payload');
        }

        $eventType = $event['event_type'] ?? '';
        $resource = $event['resource'] ?? [];

        switch ($eventType) {
            case 'CHECKOUT.ORDER.APPROVED':
                return $this->handleOrderApproved($resource);

            case 'PAYMENT.CAPTURE.COMPLETED':
                return $this->handleCaptureCompleted($resource);

            case 'PAYMENT.CAPTURE.DENIED':
            case 'PAYMENT.CAPTURE.DECLINED':
                return $this->handleCaptureFailed($resource);

            default:
                return [
                    'success' => true,
                    'event_type' => $eventType,
                    'action' => 'ignored',
                ];
        }
    }

    private function handleOrderApproved(array $order): array
    {
        $orderId = $order['id'] ?? '';

        // Capture the payment
        try {
            $capture = $this->paypalRequest("/v2/checkout/orders/{$orderId}/capture", []);

            $transaction = $this->getTransactionByProviderId($orderId);
            if ($transaction) {
                $this->updateTransaction(
                    (int) $transaction['id'],
                    'completed',
                    $orderId,
                    [
                        'capture_id' => $capture['purchase_units'][0]['payments']['captures'][0]['id'] ?? null,
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

            return [
                'success' => true,
                'event_type' => 'CHECKOUT.ORDER.APPROVED',
                'order_id' => $orderId,
                'captured' => true,
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'event_type' => 'CHECKOUT.ORDER.APPROVED',
                'error' => $e->getMessage(),
            ];
        }
    }

    private function handleCaptureCompleted(array $capture): array
    {
        // Payment was already captured, just update status if needed
        return [
            'success' => true,
            'event_type' => 'PAYMENT.CAPTURE.COMPLETED',
            'capture_id' => $capture['id'] ?? null,
        ];
    }

    private function handleCaptureFailed(array $capture): array
    {
        $orderId = $capture['supplementary_data']['related_ids']['order_id'] ?? null;

        if ($orderId) {
            $transaction = $this->getTransactionByProviderId($orderId);
            if ($transaction) {
                $this->updateTransaction(
                    (int) $transaction['id'],
                    'failed',
                    $orderId,
                    ['failure_reason' => 'Payment capture failed']
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
            'event_type' => 'PAYMENT.CAPTURE.FAILED',
            'order_id' => $orderId,
        ];
    }

    public function getPaymentStatus(string $transactionId): array
    {
        $transaction = $this->getTransactionByProviderId($transactionId);

        if (!$transaction) {
            // Try to fetch from PayPal directly
            try {
                $order = $this->paypalRequest('/v2/checkout/orders/' . $transactionId, null, 'GET');
                return [
                    'status' => strtolower($order['status'] ?? 'unknown'),
                    'found' => true,
                    'amount' => (float) ($order['purchase_units'][0]['amount']['value'] ?? 0),
                    'currency' => $order['purchase_units'][0]['amount']['currency_code'] ?? 'USD',
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
            'provider' => 'paypal',
            'clientId' => $this->settings->get('paypal_client_id', ''),
            'mode' => $this->settings->get('paypal_mode', 'sandbox'),
        ];
    }

    public function testConnection(): array
    {
        if (!$this->isConfigured()) {
            return [
                'success' => false,
                'message' => 'PayPal credentials are not configured.',
            ];
        }

        try {
            // Test by getting an access token
            $this->getAccessToken();

            return [
                'success' => true,
                'message' => 'Connected to PayPal successfully.',
                'mode' => $this->settings->get('paypal_mode', 'sandbox'),
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'message' => 'PayPal connection failed: ' . $e->getMessage(),
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
