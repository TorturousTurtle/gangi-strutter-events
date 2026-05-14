<?php
/**
 * Manual "Pay Later" payment provider.
 * Creates registrations with pending_manual status for offline payment collection.
 */

namespace PaymentProvider;

require_once __DIR__ . '/AbstractPaymentProvider.php';

class ManualProvider extends AbstractPaymentProvider
{
    public function getName(): string
    {
        return 'manual';
    }

    public function isConfigured(): bool
    {
        // Manual provider is always "configured" if pay later is enabled
        return $this->settings->getBool('pay_later_enabled', false);
    }

    public function createPaymentSession(array $registration, array $pricing, array $urls): array
    {
        if (!$this->isConfigured()) {
            throw new \RuntimeException('Pay Later option is not enabled');
        }

        $amountCents = $this->dollarsToCents((float) ($pricing['totalWithProcessing'] ?? 0));

        // Create transaction record
        $transactionId = $this->createTransaction(
            null, // Registration ID will be set after registration is created
            $amountCents,
            'pending_manual',
            null,
            [
                'pricing' => $pricing,
                'created_via' => 'pay_later',
            ]
        );

        // Return a "pseudo session" that the frontend can use
        return [
            'id' => 'manual_' . $transactionId,
            'transactionId' => $transactionId,
            'status' => 'pending_manual',
            'redirectUrl' => $urls['successUrl'] ?? null,
            'requiresPayment' => false,
        ];
    }

    public function verifyWebhookSignature(string $payload, array $headers): bool
    {
        // Manual provider doesn't have webhooks
        return false;
    }

    public function handleWebhook(string $payload, array $headers): array
    {
        throw new \RuntimeException('Manual provider does not support webhooks');
    }

    public function getPaymentStatus(string $transactionId): array
    {
        // Extract numeric ID from "manual_123" format
        $id = (int) str_replace('manual_', '', $transactionId);
        $transaction = $this->getTransactionById($id);

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
            'provider' => 'manual',
            'payLaterEnabled' => true,
            'payLaterInstructions' => $this->settings->get('pay_later_instructions', ''),
        ];
    }

    public function testConnection(): array
    {
        return [
            'success' => true,
            'message' => 'Pay Later option is enabled and ready.',
        ];
    }

    /**
     * Mark a manual payment as completed (admin action).
     *
     * @param int $registrationId Registration ID
     * @param string|null $notes Admin notes about the payment
     * @return bool Success
     */
    public function markAsPaid(int $registrationId, ?string $notes = null): bool
    {
        // Find the transaction for this registration
        $stmt = $this->pdo->prepare("
            SELECT id FROM payment_transactions
            WHERE registration_id = ? AND provider = 'manual' AND status = 'pending_manual'
            LIMIT 1
        ");
        $stmt->execute([$registrationId]);
        $transaction = $stmt->fetch(\PDO::FETCH_ASSOC);

        if ($transaction) {
            $this->updateTransaction(
                (int) $transaction['id'],
                'completed',
                null,
                $notes ? ['admin_notes' => $notes] : null
            );
        }

        $this->updateRegistrationPayment(
            $registrationId,
            'completed',
            $transaction ? (int) $transaction['id'] : null
        );

        return true;
    }

    /**
     * Link a transaction to a registration (called after registration is created).
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

        $this->updateRegistrationPayment($registrationId, 'pending_manual', $transactionId);
    }
}
