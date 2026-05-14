#!/usr/bin/env php
<?php
/**
 * Password Hash Generator
 *
 * CLI tool to generate bcrypt hashes for the ADMIN_PASS_HASH environment variable.
 *
 * Usage:
 *   php server/hash-password.php
 *   php server/hash-password.php "your-password"
 *
 * The generated hash should be added to your .env file as ADMIN_PASS_HASH.
 */

// Ensure running from CLI
if (php_sapi_name() !== 'cli') {
    die("This script must be run from the command line.\n");
}

echo "Password Hash Generator\n";
echo "=======================\n\n";

// Get password from argument or prompt
if (isset($argv[1])) {
    $password = $argv[1];
} else {
    // Prompt for password (hide input if possible)
    echo "Enter password to hash: ";

    // Try to hide input on Unix systems
    if (function_exists('readline')) {
        system('stty -echo 2>/dev/null');
        $password = readline();
        system('stty echo 2>/dev/null');
        echo "\n";
    } else {
        $password = trim(fgets(STDIN));
    }
}

if (empty($password)) {
    echo "Error: Password cannot be empty.\n";
    exit(1);
}

// Warn about weak passwords
if (strlen($password) < 12) {
    echo "Warning: Password is less than 12 characters. Consider using a stronger password.\n\n";
}

// Generate bcrypt hash
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

echo "Generated hash:\n";
echo "---------------\n";
echo $hash . "\n\n";

echo "Add this to your .env file:\n";
echo "---------------------------\n";
echo "ADMIN_PASS_HASH=$hash\n\n";

// Verify the hash works
if (password_verify($password, $hash)) {
    echo "Verification: OK\n";
} else {
    echo "Error: Hash verification failed!\n";
    exit(1);
}
