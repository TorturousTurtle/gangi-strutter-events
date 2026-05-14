<?php
/**
 * JSON Response Helper
 *
 * Provides consistent JSON response formatting for API endpoints.
 */

class Response
{
    /**
     * Current request ID (generated once per request).
     */
    private static ?string $requestId = null;

    /**
     * Get or generate the request ID for this request.
     *
     * @return string
     */
    public static function getRequestId(): string
    {
        if (self::$requestId === null) {
            // Check if already set (e.g., by upstream load balancer)
            self::$requestId = $_SERVER['HTTP_X_REQUEST_ID']
                ?? $_SERVER['REQUEST_ID']
                ?? self::generateRequestId();
        }

        return self::$requestId;
    }

    /**
     * Generate a short unique request ID.
     *
     * @return string
     */
    private static function generateRequestId(): string
    {
        // 8 characters from random bytes, URL-safe
        return substr(bin2hex(random_bytes(4)), 0, 8);
    }

    /**
     * Send a successful JSON response and exit.
     *
     * @param mixed $data Response data (will be merged with ['ok' => true])
     * @param int $statusCode HTTP status code (default 200)
     */
    public static function success(mixed $data = [], int $statusCode = 200): never
    {
        self::json(array_merge(['ok' => true], (array) $data), $statusCode);
    }

    /**
     * Send an error JSON response and exit.
     *
     * @param string $message Error message
     * @param int $statusCode HTTP status code (default 400)
     * @param array $extra Extra data to include
     */
    public static function error(string $message, int $statusCode = 400, array $extra = []): never
    {
        $response = array_merge([
            'ok' => false,
            'error' => $message,
            'request_id' => self::getRequestId(),
        ], $extra);

        self::json($response, $statusCode);
    }

    /**
     * Send a JSON response and exit.
     *
     * @param mixed $data Data to encode as JSON
     * @param int $statusCode HTTP status code
     * @param bool $allowCompression Whether to allow gzip compression (default: true)
     */
    public static function json(mixed $data, int $statusCode = 200, bool $allowCompression = true): never
    {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');

        // Prevent caching of API responses by default
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        // Apply gzip compression for responses > 1KB if client supports it
        if ($allowCompression && strlen($json) > 1024) {
            $json = self::compressIfSupported($json);
        }

        echo $json;
        exit;
    }

    /**
     * Compress content with gzip if client supports it.
     *
     * @param string $content Content to compress
     * @return string Compressed content (or original if compression not supported)
     */
    private static function compressIfSupported(string $content): string
    {
        // Check if client accepts gzip encoding
        $acceptEncoding = $_SERVER['HTTP_ACCEPT_ENCODING'] ?? '';
        if (strpos($acceptEncoding, 'gzip') === false) {
            return $content;
        }

        // Check if gzip extension is available
        if (!function_exists('gzencode')) {
            return $content;
        }

        // Don't compress if already handled by output buffering or mod_deflate
        if (headers_sent()) {
            return $content;
        }

        $compressed = gzencode($content, 6);
        if ($compressed === false) {
            return $content;
        }

        // Only use compression if it actually reduces size
        if (strlen($compressed) >= strlen($content)) {
            return $content;
        }

        header('Content-Encoding: gzip');
        header('Vary: Accept-Encoding');

        return $compressed;
    }

    /**
     * Send a 404 Not Found response.
     *
     * @param string $message Error message
     */
    public static function notFound(string $message = 'Not found'): never
    {
        self::error($message, 404);
    }

    /**
     * Send a 401 Unauthorized response.
     *
     * @param string $message Error message
     */
    public static function unauthorized(string $message = 'Unauthorized'): never
    {
        self::error($message, 401);
    }

    /**
     * Send a 403 Forbidden response.
     *
     * @param string $message Error message
     */
    public static function forbidden(string $message = 'Forbidden'): never
    {
        self::error($message, 403);
    }

    /**
     * Send a 422 Validation Error response.
     *
     * @param array $errors Validation errors keyed by field name
     * @param string $message General error message
     */
    public static function validationError(array $errors, string $message = 'Validation failed'): never
    {
        self::json([
            'ok' => false,
            'error' => $message,
            'errors' => $errors
        ], 422);
    }

    /**
     * Send a 500 Internal Server Error response.
     *
     * @param string $message Error message
     * @param Throwable|null $exception Exception (logged but not exposed in response)
     */
    public static function serverError(string $message = 'Internal server error', ?Throwable $exception = null): never
    {
        $requestId = self::getRequestId();

        if ($exception !== null) {
            error_log(sprintf(
                "[Response] [%s] Server error: %s in %s:%d\n%s",
                $requestId,
                $exception->getMessage(),
                $exception->getFile(),
                $exception->getLine(),
                $exception->getTraceAsString()
            ));
        }

        self::error($message, 500);
    }

    /**
     * Send a 405 Method Not Allowed response.
     *
     * @param array $allowedMethods List of allowed HTTP methods
     */
    public static function methodNotAllowed(array $allowedMethods = []): never
    {
        if (!empty($allowedMethods)) {
            header('Allow: ' . implode(', ', $allowedMethods));
        }
        self::error('Method not allowed', 405);
    }

    /**
     * Send a 429 Too Many Requests response.
     *
     * @param int $retryAfter Seconds until the client should retry
     */
    public static function tooManyRequests(int $retryAfter = 60): never
    {
        header("Retry-After: $retryAfter");
        self::error('Too many requests', 429);
    }

    /**
     * Send a paginated response.
     *
     * @param array $items Items for current page
     * @param int $total Total number of items
     * @param int $page Current page number
     * @param int $perPage Items per page
     * @param string $itemsKey Key name for items array
     */
    public static function paginated(
        array $items,
        int $total,
        int $page,
        int $perPage,
        string $itemsKey = 'items'
    ): never {
        $totalPages = (int) ceil($total / $perPage);

        self::success([
            $itemsKey => $items,
            'pagination' => [
                'total' => $total,
                'page' => $page,
                'perPage' => $perPage,
                'totalPages' => $totalPages,
                'hasMore' => $page < $totalPages
            ]
        ]);
    }

    /**
     * Require specific HTTP method(s).
     *
     * @param string|array $methods Allowed method(s)
     */
    public static function requireMethod(string|array $methods): void
    {
        $methods = (array) $methods;
        $requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        if (!in_array($requestMethod, $methods, true)) {
            self::methodNotAllowed($methods);
        }
    }

    /**
     * Get JSON body from request.
     *
     * @param bool $required Whether to error if no body
     * @return array Decoded JSON data
     */
    public static function getJsonBody(bool $required = true): array
    {
        $body = file_get_contents('php://input');

        if (empty($body)) {
            if ($required) {
                self::error('Request body is required', 400);
            }
            return [];
        }

        $data = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            self::error('Invalid JSON in request body', 400);
        }

        return $data ?? [];
    }

    /**
     * Get a required parameter from request data.
     *
     * @param array $data Request data array
     * @param string $key Parameter key
     * @param string|null $errorMessage Custom error message
     * @return mixed Parameter value
     */
    public static function requireParam(array $data, string $key, ?string $errorMessage = null): mixed
    {
        if (!isset($data[$key]) || $data[$key] === '') {
            $message = $errorMessage ?? "Missing required parameter: $key";
            self::error($message, 400);
        }

        return $data[$key];
    }

    /**
     * Set CORS headers for cross-origin requests.
     *
     * @param string $origin Allowed origin (default '*')
     * @param array $methods Allowed methods
     * @param array $headers Allowed headers
     */
    public static function setCorsHeaders(
        string $origin = '*',
        array $methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        array $headers = ['Content-Type', 'Authorization']
    ): void {
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Methods: ' . implode(', ', $methods));
        header('Access-Control-Allow-Headers: ' . implode(', ', $headers));
        header('Access-Control-Max-Age: 86400');

        // Handle preflight requests
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }
}
