package com.smartapparel.app

import org.junit.jupiter.api.Test // v5.9.3
import org.junit.jupiter.api.Assertions.* // v5.9.3

/**
 * Example unit test class demonstrating basic test setup and assertions.
 * 
 * This class serves as a template for creating additional unit tests in the 
 * Smart Apparel Android application. It showcases proper test method naming,
 * annotation usage, and assertion patterns using JUnit 5.
 */
class ExampleUnitTest {

    /**
     * Example test method demonstrating basic arithmetic assertion pattern.
     * 
     * This test method follows these best practices:
     * - Descriptive method name indicating what is being tested
     * - Clear arrangement of test components (arrange, act, assert)
     * - Proper use of JUnit assertions
     * - Single responsibility - tests one specific behavior
     */
    @Test
    fun addition_isCorrect() {
        // Arrange
        val expected = 4

        // Act
        val result = 2 + 2

        // Assert
        assertEquals(expected, result, "Basic arithmetic addition should work correctly")
    }
}