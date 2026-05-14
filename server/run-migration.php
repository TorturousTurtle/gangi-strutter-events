<?php
/**
 * Database Migration Runner
 *
 * Usage: php server/run-migration.php <migration_file>
 * Example: php server/run-migration.php 006_branding_settings.sql
 */

if (php_sapi_name() !== 'cli') {
    die("This script must be run from the command line.\n");
}

if ($argc < 2) {
    echo "Usage: php {$argv[0]} <migration_file>\n";
    echo "Example: php {$argv[0]} 006_branding_settings.sql\n";
    exit(1);
}

$migrationFile = $argv[1];
$migrationsDir = __DIR__ . '/migrations';

// Handle both with and without path
if (strpos($migrationFile, '/') === false) {
    $fullPath = $migrationsDir . '/' . $migrationFile;
} else {
    $fullPath = $migrationFile;
}

if (!file_exists($fullPath)) {
    echo "Error: Migration file not found: {$fullPath}\n";
    exit(1);
}

// Load configuration
$config = require __DIR__ . '/config.php';
$db = $config['db'];

$dsn = "mysql:host={$db['host']};dbname={$db['name']};charset={$db['charset']}";

try {
    $pdo = new PDO(
        $dsn,
        $db['user'],
        $db['pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
    echo "Connected to database: {$db['name']}\n";
} catch (PDOException $e) {
    echo "Database connection failed: " . $e->getMessage() . "\n";
    exit(1);
}

// Read and execute migration
$sql = file_get_contents($fullPath);

echo "Running migration: {$migrationFile}\n";
echo str_repeat('-', 50) . "\n";

try {
    // Split by semicolon to handle multiple statements
    // But be careful not to split on semicolons inside strings
    $pdo->exec($sql);
    echo "Migration completed successfully!\n";
} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
