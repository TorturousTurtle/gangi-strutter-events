<?php
/**
 * Abstract base class for payment providers with shared functionality.
 */

namespace PaymentProvider;

require_once __DIR__ . '/PaymentProviderInterface.php';
require_once __DIR__ . '/../Settings.php';

abstract class AbstractPaymentProvider implements PaymentProviderInterface
{
    protected \Settings $settings;
    protected \PDO $pdo;

    public function __construct(\Settings $settings, \PDO $pdo)
    {
        $this->settings = $settings;
        $this->pdo = $pdo;
    }

    /**
     * Create a payment transaction record.
     *
     * @param int|null $registrationId Registration ID (null for pre-registration)
     * @param int $amountCents Amount in cents
     * @param string $status Initial status
     * @param string|null $providerTransactionId External transaction ID
     * @param array|null $metadata Additional metadata
     * @return int Transaction ID
     */
    protected function createTransaction(
        ?int $registrationId,
        int $amountCents,
        string $status = 'pending',
        ?string $providerTransactionId = null,
        ?array $metadata = null
    ): int {
        $stmt = $this->pdo->prepare("
            INSERT INTO payment_transactions
            (registration_id, provider, provider_transaction_id, amount_cents, currency, status, metadata_json)
            VALUES (?, ?, ?, ?, 'USD', ?, ?)
        ");

        $stmt->execute([
            $registrationId,
            $this->getName(),
            $providerTransactionId,
            $amountCents,
            $status,
            $metadata ? json_encode($metadata) : null,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Update a payment transaction record.
     *
     * @param int $transactionId Transaction ID
     * @param string $status New status
     * @param string|null $providerTransactionId External transaction ID
     * @param array|null $metadata Additional metadata to merge
     */
    protected function updateTransaction(
        int $transactionId,
        string $status,
        ?string $providerTransactionId = null,
        ?array $metadata = null
    ): void {
        $updates = ['status = ?'];
        $params = [$status];

        if ($providerTransactionId !== null) {
            $updates[] = 'provider_transaction_id = ?';
            $params[] = $providerTransactionId;
        }

        if ($metadata !== null) {
            $updates[] = 'metadata_json = JSON_MERGE_PATCH(COALESCE(metadata_json, "{}"), ?)';
            $params[] = json_encode($metadata);
        }

        if ($status === 'completed') {
            $updates[] = 'completed_at = CURRENT_TIMESTAMP';
        }

        $params[] = $transactionId;

        $stmt = $this->pdo->prepare("
            UPDATE payment_transactions
            SET " . implode(', ', $updates) . "
            WHERE id = ?
        ");
        $stmt->execute($params);
    }

    /**
     * Update registration payment status.
     *
     * @param int $registrationId Registration ID
     * @param string $status Payment status
     * @param int|null $transactionId Transaction ID
     */
    protected function updateRegistrationPayment(
        int $registrationId,
        string $status,
        ?int $transactionId = null
    ): void {
        $stmt = $this->pdo->prepare("
            UPDATE registrations
            SET payment_status = ?,
                payment_provider = ?,
                payment_transaction_id = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $status,
            $this->getName(),
            $transactionId,
            $registrationId,
        ]);
    }

    /**
     * Get transaction by provider transaction ID.
     *
     * @param string $providerTransactionId External transaction ID
     * @return array|null Transaction record or null
     */
    protected function getTransactionByProviderId(string $providerTransactionId): ?array
    {
        $stmt = $this->pdo->prepare("
            SELECT * FROM payment_transactions
            WHERE provider = ? AND provider_transaction_id = ?
            LIMIT 1
        ");
        $stmt->execute([$this->getName(), $providerTransactionId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Get transaction by ID.
     *
     * @param int $transactionId Transaction ID
     * @return array|null Transaction record or null
     */
    protected function getTransactionById(int $transactionId): ?array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM payment_transactions WHERE id = ?");
        $stmt->execute([$transactionId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Convert dollars to cents.
     */
    protected function dollarsToCents(float $dollars): int
    {
        return (int) round($dollars * 100);
    }

    /**
     * Convert cents to dollars.
     */
    protected function centsToDollars(int $cents): float
    {
        return round($cents / 100, 2);
    }
}
