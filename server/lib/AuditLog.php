<?php
/**
 * Audit Log
 *
 * Logs admin actions to the database for audit trail and security review.
 * All admin actions that modify data or involve authentication should be logged.
 */

class AuditLog
{
    // Action types
    public const ACTION_LOGIN_SUCCESS = 'login_success';
    public const ACTION_LOGIN_FAILED = 'login_failed';
    public const ACTION_LOGOUT = 'logout';
    public const ACTION_COMPETITION_CREATE = 'competition_create';
    public const ACTION_COMPETITION_UPDATE = 'competition_update';
    public const ACTION_COMPETITION_DELETE = 'competition_delete';
    public const ACTION_REGISTRATION_CREATE = 'registration_create';
    public const ACTION_REGISTRATION_UPDATE = 'registration_update';
    public const ACTION_REGISTRATION_DELETE = 'registration_delete';
    public const ACTION_SETTINGS_UPDATE = 'settings_update';
    public const ACTION_COACH_CREATE = 'coach_create';
    public const ACTION_COACH_UPDATE = 'coach_update';
    public const ACTION_COACH_DELETE = 'coach_delete';

    // Entity types
    public const ENTITY_COMPETITION = 'competition';
    public const ENTITY_REGISTRATION = 'registration';
    public const ENTITY_SETTINGS = 'settings';
    public const ENTITY_COACH = 'coach';
    public const ENTITY_AUTH = 'auth';

    /**
     * Log an audit entry.
     *
     * @param string $action Action type (use class constants)
     * @param string|null $entityType Type of entity affected
     * @param int|null $entityId ID of the affected entity
     * @param array $details Additional details (sensitive values will be masked)
     */
    public static function log(
        string $action,
        ?string $entityType = null,
        ?int $entityId = null,
        array $details = []
    ): void {
        try {
            require_once __DIR__ . '/Database.php';
            require_once __DIR__ . '/Session.php';

            $pdo = Database::getInstance();

            // Get actor info
            $ip = self::getClientIp();
            $user = Session::getUser();

            // Mask sensitive values in details
            $maskedDetails = self::maskSensitiveData($details);

            $stmt = $pdo->prepare('
                INSERT INTO audit_log (action, entity_type, entity_id, actor_ip, actor_user, details)
                VALUES (?, ?, ?, ?, ?, ?)
            ');

            $stmt->execute([
                $action,
                $entityType,
                $entityId,
                $ip,
                $user,
                !empty($maskedDetails) ? json_encode($maskedDetails) : null,
            ]);
        } catch (Throwable $e) {
            // Log to error log if database insert fails
            // Don't throw - audit logging should never break the main operation
            error_log(sprintf(
                '[AuditLog] Failed to write audit entry: %s - Action: %s, Entity: %s/%s',
                $e->getMessage(),
                $action,
                $entityType ?? 'null',
                $entityId ?? 'null'
            ));
        }
    }

    /**
     * Log a successful login.
     *
     * @param string $username The username that logged in
     */
    public static function logLoginSuccess(string $username): void
    {
        self::log(self::ACTION_LOGIN_SUCCESS, self::ENTITY_AUTH, null, [
            'username' => $username,
        ]);
    }

    /**
     * Log a failed login attempt.
     *
     * @param string $username The username that was attempted
     */
    public static function logLoginFailed(string $username): void
    {
        self::log(self::ACTION_LOGIN_FAILED, self::ENTITY_AUTH, null, [
            'username' => $username,
        ]);
    }

    /**
     * Log a logout.
     *
     * @param string|null $username The username that logged out
     */
    public static function logLogout(?string $username = null): void
    {
        self::log(self::ACTION_LOGOUT, self::ENTITY_AUTH, null, [
            'username' => $username,
        ]);
    }

    /**
     * Log a competition change.
     *
     * @param string $action The action (create, update, delete)
     * @param int $competitionId The competition ID
     * @param array $details Change details
     */
    public static function logCompetition(string $action, int $competitionId, array $details = []): void
    {
        self::log($action, self::ENTITY_COMPETITION, $competitionId, $details);
    }

    /**
     * Log a registration change.
     *
     * @param string $action The action (create, update, delete)
     * @param int $registrationId The registration ID
     * @param array $details Change details
     */
    public static function logRegistration(string $action, int $registrationId, array $details = []): void
    {
        self::log($action, self::ENTITY_REGISTRATION, $registrationId, $details);
    }

    /**
     * Log a settings change.
     *
     * @param array $details Change details (sensitive values will be masked)
     */
    public static function logSettings(array $details = []): void
    {
        self::log(self::ACTION_SETTINGS_UPDATE, self::ENTITY_SETTINGS, null, $details);
    }

    /**
     * Get client IP address.
     *
     * @return string
     */
    private static function getClientIp(): string
    {
        $headers = [
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_REAL_IP',
            'HTTP_CLIENT_IP',
        ];

        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                $ips = explode(',', $_SERVER[$header]);
                $ip = trim($ips[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }

        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }

    /**
     * Mask sensitive values in details array.
     *
     * @param array $details
     * @return array
     */
    private static function maskSensitiveData(array $details): array
    {
        $sensitiveKeys = [
            'password',
            'pass',
            'secret',
            'key',
            'token',
            'api_key',
            'apikey',
            'secret_key',
            'private_key',
            'webhook_secret',
        ];

        $masked = [];
        foreach ($details as $key => $value) {
            $lowerKey = strtolower($key);
            $isSensitive = false;

            foreach ($sensitiveKeys as $sensitiveKey) {
                if (str_contains($lowerKey, $sensitiveKey)) {
                    $isSensitive = true;
                    break;
                }
            }

            if ($isSensitive && is_string($value) && strlen($value) > 0) {
                // Show first 4 and last 4 characters if long enough
                if (strlen($value) > 12) {
                    $masked[$key] = substr($value, 0, 4) . '****' . substr($value, -4);
                } else {
                    $masked[$key] = '********';
                }
            } elseif (is_array($value)) {
                $masked[$key] = self::maskSensitiveData($value);
            } else {
                $masked[$key] = $value;
            }
        }

        return $masked;
    }

    /**
     * Get recent audit log entries.
     *
     * @param int $limit Maximum entries to return
     * @param string|null $action Filter by action type
     * @param string|null $entityType Filter by entity type
     * @return array
     */
    public static function getRecent(int $limit = 100, ?string $action = null, ?string $entityType = null): array
    {
        require_once __DIR__ . '/Database.php';

        $pdo = Database::getInstance();

        $sql = 'SELECT * FROM audit_log WHERE 1=1';
        $params = [];

        if ($action !== null) {
            $sql .= ' AND action = ?';
            $params[] = $action;
        }

        if ($entityType !== null) {
            $sql .= ' AND entity_type = ?';
            $params[] = $entityType;
        }

        $sql .= ' ORDER BY created_at DESC LIMIT ?';
        $params[] = $limit;

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
