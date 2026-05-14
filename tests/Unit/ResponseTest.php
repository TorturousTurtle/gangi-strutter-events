<?php
/**
 * Response Tests
 *
 * Unit tests for the Response class.
 */

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use Response;

class ResponseTest extends TestCase
{
    /**
     * Test that getRequestId() generates a request ID.
     */
    public function testGetRequestIdGeneratesId(): void
    {
        // Clear any existing request ID by using reflection
        $reflection = new \ReflectionClass(Response::class);
        $property = $reflection->getProperty('requestId');
        $property->setAccessible(true);
        $property->setValue(null, null);

        $requestId = Response::getRequestId();

        $this->assertNotEmpty($requestId);
        $this->assertEquals(8, strlen($requestId));
    }

    /**
     * Test that getRequestId() returns the same ID within a request.
     */
    public function testGetRequestIdReturnsSameId(): void
    {
        // Clear any existing request ID
        $reflection = new \ReflectionClass(Response::class);
        $property = $reflection->getProperty('requestId');
        $property->setAccessible(true);
        $property->setValue(null, null);

        $requestId1 = Response::getRequestId();
        $requestId2 = Response::getRequestId();

        $this->assertEquals($requestId1, $requestId2);
    }

    /**
     * Test that getRequestId() uses upstream header if provided.
     */
    public function testGetRequestIdUsesUpstreamHeader(): void
    {
        // Clear any existing request ID
        $reflection = new \ReflectionClass(Response::class);
        $property = $reflection->getProperty('requestId');
        $property->setAccessible(true);
        $property->setValue(null, null);

        // Set upstream header
        $_SERVER['HTTP_X_REQUEST_ID'] = 'upstream-123';

        $requestId = Response::getRequestId();

        $this->assertEquals('upstream-123', $requestId);

        // Clean up
        unset($_SERVER['HTTP_X_REQUEST_ID']);
    }
}
