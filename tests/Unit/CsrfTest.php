<?php
/**
 * CSRF Tests
 *
 * Unit tests for the Csrf class.
 */

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use Csrf;

class CsrfTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Start fresh session for each test
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
        $_SESSION = [];
    }

    protected function tearDown(): void
    {
        parent::tearDown();

        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
        $_SESSION = [];
    }

    /**
     * Test that generate() creates a token.
     */
    public function testGenerateCreatesToken(): void
    {
        $token = Csrf::generate();

        $this->assertNotEmpty($token);
        $this->assertEquals(64, strlen($token)); // 32 bytes = 64 hex chars
    }

    /**
     * Test that generate() creates different tokens each time.
     */
    public function testGenerateCreatesDifferentTokens(): void
    {
        $token1 = Csrf::generate();
        $token2 = Csrf::generate();

        $this->assertNotEquals($token1, $token2);
    }

    /**
     * Test that getToken() returns the same token if not regenerated.
     */
    public function testGetTokenReturnsSameToken(): void
    {
        $token1 = Csrf::getToken();
        $token2 = Csrf::getToken();

        $this->assertEquals($token1, $token2);
    }

    /**
     * Test that isValid() returns false without a token.
     */
    public function testIsValidReturnsFalseWithoutToken(): void
    {
        // No token in session
        $_SESSION = [];

        $this->assertFalse(Csrf::isValid());
    }

    /**
     * Test that isValid() returns false with wrong token.
     */
    public function testIsValidReturnsFalseWithWrongToken(): void
    {
        $token = Csrf::generate();

        // Set wrong token in header
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'wrong_token';

        $this->assertFalse(Csrf::isValid());
    }

    /**
     * Test that isValid() returns true with correct token.
     */
    public function testIsValidReturnsTrueWithCorrectToken(): void
    {
        $token = Csrf::generate();

        // Set correct token in header
        $_SERVER['HTTP_X_CSRF_TOKEN'] = $token;

        $this->assertTrue(Csrf::isValid());
    }

    /**
     * Test that regenerate() creates a new token.
     */
    public function testRegenerateCreatesNewToken(): void
    {
        $token1 = Csrf::getToken();
        $token2 = Csrf::regenerate();

        $this->assertNotEquals($token1, $token2);
    }
}
