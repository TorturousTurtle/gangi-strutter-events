<?php
/**
 * PSR-4 Autoloader
 *
 * Simple PSR-4 compatible autoloader for the application.
 * Handles class loading from the /server/lib directory.
 *
 * Usage:
 *   require_once __DIR__ . '/autoload.php';
 *
 * This will automatically load classes like:
 *   - Env -> /server/lib/Env.php
 *   - Database -> /server/lib/Database.php
 *   - PaymentProvider\StripeProvider -> /server/lib/PaymentProvider/StripeProvider.php
 *   - Branding\BrandingService -> /server/lib/Branding/BrandingService.php
 */

spl_autoload_register(function (string $class): void {
    // Base directory for the lib namespace
    $baseDir = __DIR__ . '/lib/';

    // Replace namespace separators with directory separators
    $relativeClass = str_replace('\\', '/', $class);

    // Build the file path
    $file = $baseDir . $relativeClass . '.php';

    // If the file exists, require it
    if (file_exists($file)) {
        require_once $file;
        return;
    }

    // Try without namespace prefix (for backward compatibility with non-namespaced classes)
    // e.g., "Env" -> /server/lib/Env.php
    $simpleFile = $baseDir . $class . '.php';
    if (file_exists($simpleFile)) {
        require_once $simpleFile;
        return;
    }
});

/**
 * Helper function to require all files in a directory.
 * Useful for loading all payment providers, etc.
 *
 * @param string $directory Absolute directory path
 * @param bool $recursive Whether to load subdirectories
 */
function autoload_directory(string $directory, bool $recursive = false): void
{
    if (!is_dir($directory)) {
        return;
    }

    $files = scandir($directory);

    foreach ($files as $file) {
        if ($file === '.' || $file === '..') {
            continue;
        }

        $path = $directory . '/' . $file;

        if (is_dir($path) && $recursive) {
            autoload_directory($path, true);
        } else if (is_file($path) && str_ends_with($file, '.php')) {
            require_once $path;
        }
    }
}

/**
 * Convenience function to load the environment.
 * Call this at the start of your application.
 */
function bootstrap(): void
{
    // Load environment variables
    if (class_exists('Env')) {
        Env::load();
    }
}
