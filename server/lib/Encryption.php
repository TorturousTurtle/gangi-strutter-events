<?php
/**
 * Encryption utility for secure credential storage.
 * Uses AES-256-GCM for authenticated encryption.
 */

class Encryption
{
    private const CIPHER = 'aes-256-gcm';
    private const IV_LENGTH = 12;    // GCM recommended IV length
    private const TAG_LENGTH = 16;   // GCM tag length

    private string $key;

    /**
     * Create an Encryption instance.
     *
     * @param string|null $key 32-byte binary key (or 64-char hex string)
     * @throws RuntimeException if key is invalid or missing
     */
    public function __construct(?string $key = null)
    {
        if ($key === null) {
            require_once __DIR__ . '/Env.php';
            Env::load();
            $key = Env::get('ENCRYPTION_KEY', '');
        }

        if ($key === '') {
            throw new RuntimeException('ENCRYPTION_KEY is not configured');
        }

        // Convert hex string to binary if needed
        if (strlen($key) === 64 && ctype_xdigit($key)) {
            $key = hex2bin($key);
        }

        if (strlen($key) !== 32) {
            throw new RuntimeException('ENCRYPTION_KEY must be 32 bytes (or 64 hex characters)');
        }

        $this->key = $key;
    }

    /**
     * Encrypt a plaintext string.
     *
     * @param string $plaintext Data to encrypt
     * @return string Binary string: IV (12 bytes) + ciphertext + tag (16 bytes)
     * @throws RuntimeException on encryption failure
     */
    public function encrypt(string $plaintext): string
    {
        $iv = random_bytes(self::IV_LENGTH);
        $tag = '';

        $ciphertext = openssl_encrypt(
            $plaintext,
            self::CIPHER,
            $this->key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            self::TAG_LENGTH
        );

        if ($ciphertext === false) {
            throw new RuntimeException('Encryption failed: ' . openssl_error_string());
        }

        // Pack as: IV + ciphertext + tag
        return $iv . $ciphertext . $tag;
    }

    /**
     * Decrypt an encrypted string.
     *
     * @param string $encrypted Binary string from encrypt()
     * @return string Decrypted plaintext
     * @throws RuntimeException on decryption failure or tampering
     */
    public function decrypt(string $encrypted): string
    {
        if (strlen($encrypted) < self::IV_LENGTH + self::TAG_LENGTH + 1) {
            throw new RuntimeException('Invalid encrypted data: too short');
        }

        // Unpack: IV + ciphertext + tag
        $iv = substr($encrypted, 0, self::IV_LENGTH);
        $tag = substr($encrypted, -self::TAG_LENGTH);
        $ciphertext = substr($encrypted, self::IV_LENGTH, -self::TAG_LENGTH);

        $plaintext = openssl_decrypt(
            $ciphertext,
            self::CIPHER,
            $this->key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );

        if ($plaintext === false) {
            throw new RuntimeException('Decryption failed: data may be corrupted or tampered');
        }

        return $plaintext;
    }

    /**
     * Generate a new random encryption key.
     *
     * @return string 64-character hex string (32 bytes)
     */
    public static function generateKey(): string
    {
        return bin2hex(random_bytes(32));
    }
}
