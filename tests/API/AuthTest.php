<?php
/**
 * Auth Endpoint Tests
 *
 * Tests for the authentication endpoints:
 * - /api/auth/login.php
 * - /api/auth/logout.php
 * - /api/auth/check.php
 */

declare(strict_types=1);

namespace Tests\API;

use PHPUnit\Framework\TestCase;

class AuthTest extends TestCase
{
    private string $baseUrl;

    protected function setUp(): void
    {
        parent::setUp();

        // Base URL for API requests
        // In a real test environment, this would point to a test server
        $this->baseUrl = getenv('TEST_API_URL') ?: 'http://localhost:8000';
    }

    protected function tearDown(): void
    {
        parent::tearDown();
    }

    /**
     * Test that login endpoint exists and accepts POST.
     */
    public function testLoginEndpointAcceptsPost(): void
    {
        $response = $this->makeRequest('POST', '/api/auth/login.php', [
            'username' => 'test',
            'password' => 'test',
        ]);

        // Should return JSON (even if credentials are wrong)
        $this->assertArrayHasKey('ok', $response);
    }

    /**
     * Test that login endpoint rejects GET requests.
     */
    public function testLoginEndpointRejectsGet(): void
    {
        $response = $this->makeRequest('GET', '/api/auth/login.php');

        $this->assertFalse($response['ok'] ?? true);
        $this->assertEquals(405, $response['_http_code'] ?? 200);
    }

    /**
     * Test that login requires username and password.
     */
    public function testLoginRequiresCredentials(): void
    {
        $response = $this->makeRequest('POST', '/api/auth/login.php', []);

        $this->assertFalse($response['ok']);
        $this->assertStringContainsString('required', strtolower($response['error'] ?? ''));
    }

    /**
     * Test that login fails with invalid credentials.
     */
    public function testLoginFailsWithInvalidCredentials(): void
    {
        $response = $this->makeRequest('POST', '/api/auth/login.php', [
            'username' => 'invalid_user',
            'password' => 'invalid_password',
        ]);

        $this->assertFalse($response['ok']);
        $this->assertEquals(401, $response['_http_code'] ?? 200);
    }

    /**
     * Test that check endpoint returns unauthenticated for new session.
     */
    public function testCheckReturnsFalseWithoutSession(): void
    {
        $response = $this->makeRequest('GET', '/api/auth/check.php');

        $this->assertTrue($response['ok']);
        $this->assertFalse($response['authenticated'] ?? true);
    }

    /**
     * Test that logout endpoint accepts POST.
     */
    public function testLogoutEndpointAcceptsPost(): void
    {
        $response = $this->makeRequest('POST', '/api/auth/logout.php');

        $this->assertTrue($response['ok']);
        $this->assertEquals('Logged out', $response['message'] ?? '');
    }

    /**
     * Helper method to make HTTP requests.
     *
     * @param string $method HTTP method
     * @param string $endpoint API endpoint
     * @param array|null $body Request body (for POST)
     * @return array Response data with _http_code added
     */
    private function makeRequest(string $method, string $endpoint, ?array $body = null): array
    {
        $url = $this->baseUrl . $endpoint;

        $options = [
            'http' => [
                'method' => $method,
                'header' => [
                    'Content-Type: application/json',
                    'Accept: application/json',
                ],
                'ignore_errors' => true,
            ],
        ];

        if ($body !== null && $method !== 'GET') {
            $options['http']['content'] = json_encode($body);
        }

        $context = stream_context_create($options);

        try {
            $response = @file_get_contents($url, false, $context);

            // Get HTTP response code from headers
            $httpCode = 200;
            if (isset($http_response_header)) {
                foreach ($http_response_header as $header) {
                    if (preg_match('/^HTTP\/\d+\.\d+\s+(\d+)/', $header, $matches)) {
                        $httpCode = (int) $matches[1];
                    }
                }
            }

            if ($response === false) {
                return ['ok' => false, 'error' => 'Request failed', '_http_code' => 0];
            }

            $data = json_decode($response, true) ?? [];
            $data['_http_code'] = $httpCode;

            return $data;
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage(), '_http_code' => 0];
        }
    }
}
