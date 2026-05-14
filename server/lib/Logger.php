<?php
/**
 * File-based Logger
 *
 * Provides file-based logging with automatic rotation.
 * Logs are written to the configured directory with daily rotation.
 */

class Logger
{
    /**
     * Log levels (following PSR-3).
     */
    public const EMERGENCY = 'emergency';
    public const ALERT = 'alert';
    public const CRITICAL = 'critical';
    public const ERROR = 'error';
    public const WARNING = 'warning';
    public const NOTICE = 'notice';
    public const INFO = 'info';
    public const DEBUG = 'debug';

    /**
     * Default log directory.
     */
    private const DEFAULT_LOG_DIR = '/tmp/app_logs';

    /**
     * Maximum log file size in bytes before rotation (10MB).
     */
    private const MAX_FILE_SIZE = 10 * 1024 * 1024;

    /**
     * Number of rotated files to keep.
     */
    private const MAX_ROTATED_FILES = 5;

    /**
     * Singleton instances per channel.
     */
    private static array $instances = [];

    /**
     * Log directory.
     */
    private string $logDir;

    /**
     * Log file prefix (channel name).
     */
    private string $channel;

    /**
     * Minimum log level to write.
     */
    private int $minLevel;

    /**
     * Log level priorities (higher = more severe).
     */
    private static array $levelPriority = [
        self::DEBUG => 0,
        self::INFO => 1,
        self::NOTICE => 2,
        self::WARNING => 3,
        self::ERROR => 4,
        self::CRITICAL => 5,
        self::ALERT => 6,
        self::EMERGENCY => 7,
    ];

    /**
     * Create a new Logger instance.
     *
     * @param string $channel Log channel/prefix (default: 'app')
     * @param string|null $logDir Log directory (default: /tmp/app_logs)
     * @param string $minLevel Minimum log level to record
     */
    public function __construct(
        string $channel = 'app',
        ?string $logDir = null,
        string $minLevel = self::DEBUG
    ) {
        $this->channel = preg_replace('/[^a-zA-Z0-9_-]/', '_', $channel);
        $this->logDir = $logDir ?? self::DEFAULT_LOG_DIR;
        $this->minLevel = self::$levelPriority[$minLevel] ?? 0;

        $this->ensureLogDir();
    }

    /**
     * Get or create a logger instance for a channel.
     *
     * @param string $channel Channel name
     * @return self
     */
    public static function channel(string $channel): self
    {
        if (!isset(self::$instances[$channel])) {
            self::$instances[$channel] = new self($channel);
        }

        return self::$instances[$channel];
    }

    /**
     * Get the default logger instance.
     *
     * @return self
     */
    public static function getInstance(): self
    {
        return self::channel('app');
    }

    /**
     * Log an emergency message.
     */
    public function emergency(string $message, array $context = []): void
    {
        $this->log(self::EMERGENCY, $message, $context);
    }

    /**
     * Log an alert message.
     */
    public function alert(string $message, array $context = []): void
    {
        $this->log(self::ALERT, $message, $context);
    }

    /**
     * Log a critical message.
     */
    public function critical(string $message, array $context = []): void
    {
        $this->log(self::CRITICAL, $message, $context);
    }

    /**
     * Log an error message.
     */
    public function error(string $message, array $context = []): void
    {
        $this->log(self::ERROR, $message, $context);
    }

    /**
     * Log a warning message.
     */
    public function warning(string $message, array $context = []): void
    {
        $this->log(self::WARNING, $message, $context);
    }

    /**
     * Log a notice message.
     */
    public function notice(string $message, array $context = []): void
    {
        $this->log(self::NOTICE, $message, $context);
    }

    /**
     * Log an info message.
     */
    public function info(string $message, array $context = []): void
    {
        $this->log(self::INFO, $message, $context);
    }

    /**
     * Log a debug message.
     */
    public function debug(string $message, array $context = []): void
    {
        $this->log(self::DEBUG, $message, $context);
    }

    /**
     * Log a message at the specified level.
     *
     * @param string $level Log level
     * @param string $message Log message
     * @param array $context Context data
     */
    public function log(string $level, string $message, array $context = []): void
    {
        // Check minimum level
        $priority = self::$levelPriority[$level] ?? 0;
        if ($priority < $this->minLevel) {
            return;
        }

        // Interpolate context into message
        $message = $this->interpolate($message, $context);

        // Format log entry
        $entry = $this->formatEntry($level, $message, $context);

        // Write to file
        $this->write($entry);
    }

    /**
     * Interpolate context values into message placeholders.
     *
     * @param string $message
     * @param array $context
     * @return string
     */
    private function interpolate(string $message, array $context): string
    {
        $replace = [];
        foreach ($context as $key => $val) {
            if (is_string($val) || (is_object($val) && method_exists($val, '__toString'))) {
                $replace['{' . $key . '}'] = $val;
            }
        }

        return strtr($message, $replace);
    }

    /**
     * Format a log entry.
     *
     * @param string $level
     * @param string $message
     * @param array $context
     * @return string
     */
    private function formatEntry(string $level, string $message, array $context): string
    {
        $timestamp = date('Y-m-d H:i:s');
        $levelUpper = strtoupper($level);

        // Include request ID if available
        $requestId = $context['request_id'] ?? ($_SERVER['REQUEST_ID'] ?? null);
        $requestIdStr = $requestId ? " [$requestId]" : '';

        // Format context (exclude already interpolated values)
        $contextStr = '';
        $extraContext = array_filter($context, function ($key) {
            return !in_array($key, ['request_id', 'exception'], true);
        }, ARRAY_FILTER_USE_KEY);

        if (!empty($extraContext)) {
            $contextStr = ' ' . json_encode($extraContext);
        }

        // Format exception if present
        $exceptionStr = '';
        if (isset($context['exception']) && $context['exception'] instanceof Throwable) {
            $e = $context['exception'];
            $exceptionStr = sprintf(
                "\n  Exception: %s in %s:%d\n  %s",
                $e->getMessage(),
                $e->getFile(),
                $e->getLine(),
                $e->getTraceAsString()
            );
        }

        return "[$timestamp] [$levelUpper]$requestIdStr $message$contextStr$exceptionStr\n";
    }

    /**
     * Write an entry to the log file.
     *
     * @param string $entry
     */
    private function write(string $entry): void
    {
        $filePath = $this->getLogFilePath();

        // Check for rotation before writing
        $this->rotateIfNeeded($filePath);

        // Append to log file
        $fp = @fopen($filePath, 'a');
        if ($fp === false) {
            error_log("[Logger] Failed to open log file: $filePath");
            return;
        }

        if (flock($fp, LOCK_EX)) {
            fwrite($fp, $entry);
            flock($fp, LOCK_UN);
        }

        fclose($fp);
    }

    /**
     * Get the current log file path.
     *
     * @return string
     */
    private function getLogFilePath(): string
    {
        $date = date('Y-m-d');
        return $this->logDir . '/' . $this->channel . '-' . $date . '.log';
    }

    /**
     * Rotate log file if it exceeds the maximum size.
     *
     * @param string $filePath
     */
    private function rotateIfNeeded(string $filePath): void
    {
        if (!file_exists($filePath)) {
            return;
        }

        $size = @filesize($filePath);
        if ($size === false || $size < self::MAX_FILE_SIZE) {
            return;
        }

        // Rotate existing files
        for ($i = self::MAX_ROTATED_FILES - 1; $i >= 1; $i--) {
            $oldPath = $filePath . '.' . $i;
            $newPath = $filePath . '.' . ($i + 1);

            if (file_exists($oldPath)) {
                @rename($oldPath, $newPath);
            }
        }

        // Rotate current file
        @rename($filePath, $filePath . '.1');

        // Delete oldest if too many
        $oldestPath = $filePath . '.' . (self::MAX_ROTATED_FILES + 1);
        if (file_exists($oldestPath)) {
            @unlink($oldestPath);
        }
    }

    /**
     * Ensure the log directory exists.
     */
    private function ensureLogDir(): void
    {
        if (!is_dir($this->logDir)) {
            @mkdir($this->logDir, 0755, true);
        }
    }

    /**
     * Clean up old log files.
     *
     * @param int $maxAgeDays Maximum age in days for log files
     * @return int Number of files deleted
     */
    public function cleanup(int $maxAgeDays = 30): int
    {
        $count = 0;
        $maxAge = $maxAgeDays * 86400;
        $now = time();

        $files = glob($this->logDir . '/' . $this->channel . '-*.log*');
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
