<?php
/**
 * PHPUnit Bootstrap
 *
 * Sets up the test environment for PHPUnit tests.
 */

// Set error reporting
error_reporting(E_ALL);
ini_set('display_errors', '1');

// Define testing environment
define('TESTING', true);

// Set up autoloading
$projectRoot = dirname(__DIR__);

// Composer autoloader (if available)
$composerAutoload = $projectRoot . '/vendor/autoload.php';
if (file_exists($composerAutoload)) {
    require_once $composerAutoload;
}

// Manual class loading for server/lib classes
spl_autoload_register(function ($class) use ($projectRoot) {
    // Remove namespace prefix if present
    $className = str_replace('\\', '/', $class);
    $className = basename($className);

    $file = $projectRoot . '/server/lib/' . $className . '.php';
    if (file_exists($file)) {
        require_once $file;
        return true;
    }

    return false;
});

// Load environment from .env.testing if it exists, otherwise from .env
$envFile = $projectRoot . '/.env.testing';
if (!file_exists($envFile)) {
    $envFile = $projectRoot . '/.env';
}

// Simple env loader for tests
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if (strpos($line, '#') === 0 || strpos($line, '=') === false) {
            continue;
        }
        [$key, $value] = array_map('trim', explode('=', $line, 2));
        if (!isset($_ENV[$key])) {
            $_ENV[$key] = $value;
            putenv("$key=$value");
        }
    }
}

// Override with test-specific values
$_ENV['APP_ENV'] = 'testing';
putenv('APP_ENV=testing');

// Set timezone
date_default_timezone_set('UTC');

/**
 * Helper function to create a test double for superglobals.
 *
 * @param array $server $_SERVER values
 * @param array $session $_SESSION values
 * @return void
 */
function setTestEnvironment(array $server = [], array $session = []): void
{
    // Reset superglobals
    $_SERVER = array_merge($_SERVER, $server);

    // Start session if needed
    if (!empty($session)) {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
        $_SESSION = array_merge($_SESSION ?? [], $session);
    }
}

/**
 * Helper function to reset test environment.
 *
 * @return void
 */
function resetTestEnvironment(): void
{
    // Clear session
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
    $_SESSION = [];

    // Reset output buffer
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
}
