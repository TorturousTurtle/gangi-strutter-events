<?php
/**
 * Rate Limiter
 *
 * File-based token bucket rate limiter for IP-based request throttling.
 * Uses the file system for storage, which is suitable for single-server deployments.
 */

class RateLimiter
{
    /**
     * Directory for storing rate limit data.
     */
    private const DEFAULT_STORAGE_DIR = '/tmp/rate_limits';

    /**
     * Storage directory path.
     *
     * @var string
     */
    private string $storageDir;

    /**
     * Maximum number of requests allowed in the window.
     *
     * @var int
     */
    private int $maxRequests;

    /**
     * Time window in seconds.
     *
     * @var int
     */
    private int $windowSeconds;

    /**
     * Identifier for the rate limit (e.g., endpoint name).
     *
     * @var string
     */
    private string $identifier;

    /**
     * Create a new RateLimiter instance.
     *
     * @param string $identifier Unique identifier for this rate limit (e.g., 'register')
     * @param int $maxRequests Maximum requests allowed in the window
     * @param int $windowSeconds Time window in seconds
     * @param string|null $storageDir Custom storage directory (default: /tmp/rate_limits)
     */
    public function __construct(
        string $identifier,
        int $maxRequests = 10,
        int $windowSeconds = 60,
        ?string $storageDir = null
    ) {
        $this->identifier = preg_replace('/[^a-zA-Z0-9_-]/', '_', $identifier);
        $this->maxRequests = $maxRequests;
        $this->windowSeconds = $windowSeconds;
        $this->storageDir = $storageDir ?? self::DEFAULT_STORAGE_DIR;

        $this->ensureStorageDir();
    }

    /**
     * Check if a request is allowed for the given key (typically IP address).
     * If allowed, consumes one token from the bucket.
     *
     * @param string $key Unique key for the client (e.g., IP address)
     * @return bool True if request is allowed, false if rate limited
     */
    public function check(string $key): bool
    {
        $filePath = $this->getFilePath($key);
        $now = time();

        // Read current state
        $data = $this->readData($filePath);

        // Reset if window has expired
        if ($data === null || ($now - $data['window_start']) >= $this->windowSeconds) {
            $data = [
                'window_start' => $now,
                'request_count' => 0,
            ];
        }

        // Check if under limit
        if ($data['request_count'] < $this->maxRequests) {
            // Increment and save
            $data['request_count']++;
            $this->writeData($filePath, $data);
            return true;
        }

        return false;
    }

    /**
     * Get the number of remaining requests for a key.
     *
     * @param string $key Unique key for the client
     * @return int Number of remaining requests in current window
     */
    public function remaining(string $key): int
    {
        $filePath = $this->getFilePath($key);
        $now = time();

        $data = $this->readData($filePath);

        // If no data or window expired, full quota available
        if ($data === null || ($now - $data['window_start']) >= $this->windowSeconds) {
            return $this->maxRequests;
        }

        return max(0, $this->maxRequests - $data['request_count']);
    }

    /**
     * Get seconds until the rate limit window resets.
     *
     * @param string $key Unique key for the client
     * @return int Seconds until reset (0 if window has expired)
     */
    public function resetIn(string $key): int
    {
        $filePath = $this->getFilePath($key);
        $now = time();

        $data = $this->readData($filePath);

        if ($data === null) {
            return 0;
        }

        $elapsed = $now - $data['window_start'];
        $remaining = $this->windowSeconds - $elapsed;

        return max(0, $remaining);
    }

    /**
     * Reset rate limit for a specific key.
     *
     * @param string $key Unique key for the client
     */
    public function reset(string $key): void
    {
        $filePath = $this->getFilePath($key);
        if (file_exists($filePath)) {
            @unlink($filePath);
        }
    }

    /**
     * Get the client's IP address.
     *
     * @return string IP address
     */
    public static function getClientIp(): string
    {
        // Check for proxied IP (trust X-Forwarded-For only in controlled environments)
        $headers = [
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_REAL_IP',
            'HTTP_CLIENT_IP',
        ];

        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                // X-Forwarded-For can contain multiple IPs, take the first
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
     * Convenience method to check rate limit and send 429 response if exceeded.
     *
     * @param string|null $key Client key (defaults to client IP)
     * @return bool True if request is allowed (continue processing)
     */
    public function checkOrFail(?string $key = null): bool
    {
        $key = $key ?? self::getClientIp();

        if ($this->check($key)) {
            // Set rate limit headers
            $this->setRateLimitHeaders($key);
            return true;
        }

        // Rate limited - send 429 response
        $this->setRateLimitHeaders($key);
        $retryAfter = $this->resetIn($key);

        http_response_code(429);
        header('Content-Type: application/json; charset=utf-8');
        header("Retry-After: $retryAfter");

        echo json_encode([
            'ok' => false,
            'error' => 'Too many requests. Please try again later.',
            'retry_after' => $retryAfter,
        ]);

        return false;
    }

    /**
     * Set standard rate limit headers.
     *
     * @param string $key Client key
     */
    public function setRateLimitHeaders(string $key): void
    {
        $remaining = $this->remaining($key);
        $resetIn = $this->resetIn($key);

        header("X-RateLimit-Limit: {$this->maxRequests}");
        header("X-RateLimit-Remaining: $remaining");
        header("X-RateLimit-Reset: " . (time() + $resetIn));
    }

    /**
     * Get the file path for a rate limit key.
     *
     * @param string $key Client key
     * @return string File path
     */
    private function getFilePath(string $key): string
    {
        // Hash the key to create a safe filename
        $hash = md5($this->identifier . ':' . $key);
        return $this->storageDir . '/' . $this->identifier . '_' . $hash . '.json';
    }

    /**
     * Read rate limit data from file.
     *
     * @param string $filePath File path
     * @return array|null Data array or null if not found/invalid
     */
    private function readData(string $filePath): ?array
    {
        if (!file_exists($filePath)) {
            return null;
        }

        $content = @file_get_contents($filePath);
        if ($content === false) {
            return null;
        }

        $data = json_decode($content, true);
        if (!is_array($data) || !isset($data['window_start'], $data['request_count'])) {
            return null;
        }

        return $data;
    }

    /**
     * Write rate limit data to file.
     *
     * @param string $filePath File path
     * @param array $data Data to write
     */
    private function writeData(string $filePath, array $data): void
    {
        $json = json_encode($data);

        // Use atomic write with lock
        $fp = @fopen($filePath, 'c');
        if ($fp === false) {
            return;
        }

        if (flock($fp, LOCK_EX)) {
            ftruncate($fp, 0);
            fwrite($fp, $json);
            fflush($fp);
            flock($fp, LOCK_UN);
        }

        fclose($fp);
    }

    /**
     * Ensure the storage directory exists.
     */
    private function ensureStorageDir(): void
    {
        if (!is_dir($this->storageDir)) {
            @mkdir($this->storageDir, 0755, true);
        }
    }

    /**
     * Clean up expired rate limit files (maintenance task).
     * Call this periodically (e.g., via cron) to prevent file accumulation.
     *
     * @param int $maxAge Maximum age in seconds for files to keep (default: 1 hour)
     * @return int Number of files cleaned
     */
    public function cleanup(int $maxAge = 3600): int
    {
        $count = 0;
        $now = time();

        $files = glob($this->storageDir . '/' . $this->identifier . '_*.json');
        if (!is_array($files)) {
            return 0;
        }

        foreach ($files as $file) {
            $mtime = @filemtime($file);
            if ($mtime !== false && ($now - $mtime) > $maxAge) {
                if (@unlink($file)) {
                    $count++;
                }
            }
        }

        return $count;
    }
}
