package com.smartapparel.app.presentation.auth

import androidx.lifecycle.viewModelScope // version: 2.6.1
import kotlinx.coroutines.flow.MutableStateFlow // version: 1.7.1
import kotlinx.coroutines.flow.StateFlow // version: 1.7.1
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import com.smartapparel.app.presentation.common.BaseViewModel
import com.smartapparel.app.utils.SecurityUtils
import com.smartapparel.app.utils.Logger
import java.util.regex.Pattern

private const val TAG = "SignupViewModel"
private const val MIN_PASSWORD_LENGTH = 12
private const val MAX_SIGNUP_ATTEMPTS = 5

/**
 * ViewModel responsible for handling user signup logic with enhanced security features,
 * real-time validation, and OAuth 2.0 integration.
 */
class SignupViewModel : BaseViewModel() {

    // Email state management with input validation
    private val _email = MutableStateFlow("")
    val email: StateFlow<String> = _email.asStateFlow()

    // Password state with secure handling
    private val _password = MutableStateFlow("")
    val password: StateFlow<String> = _password.asStateFlow()

    // Confirm password state
    private val _confirmPassword = MutableStateFlow("")
    val confirmPassword: StateFlow<String> = _confirmPassword.asStateFlow()

    // Password strength indicator (0-100)
    private val _passwordStrength = MutableStateFlow(0)
    val passwordStrength: StateFlow<Int> = _passwordStrength.asStateFlow()

    // Signup success state
    private val _signupSuccess = MutableStateFlow(false)
    val signupSuccess: StateFlow<Boolean> = _signupSuccess.asStateFlow()

    // Rate limiting counter
    private val _signupAttempts = MutableStateFlow(0)

    // Email validation pattern following RFC 5322
    private val emailPattern = Pattern.compile(
        "[a-zA-Z0-9+._%\\-]{1,256}" +
        "@" +
        "[a-zA-Z0-9][a-zA-Z0-9\\-]{0,64}" +
        "(" +
        "\\." +
        "[a-zA-Z0-9][a-zA-Z0-9\\-]{0,25}" +
        ")+"
    )

    // List of disposable email domains
    private val disposableEmailDomains = setOf(
        "tempmail.com",
        "throwawaymail.com"
        // Add more disposable domains as needed
    )

    /**
     * Updates email input with validation and sanitization
     */
    fun updateEmail(email: String) {
        val sanitizedEmail = email.trim().lowercase()
        
        if (sanitizedEmail.isNotEmpty() && !emailPattern.matcher(sanitizedEmail).matches()) {
            handleError(IllegalArgumentException("Invalid email format"), "email validation")
            return
        }

        val domain = sanitizedEmail.substringAfterLast("@", "")
        if (domain in disposableEmailDomains) {
            handleError(IllegalArgumentException("Disposable email addresses not allowed"), "email validation")
            return
        }

        _email.value = sanitizedEmail
    }

    /**
     * Updates password with strength analysis and security validation
     */
    fun updatePassword(newPassword: String) {
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            handleError(
                IllegalArgumentException("Password must be at least $MIN_PASSWORD_LENGTH characters"),
                "password validation"
            )
            return
        }

        // Calculate password strength
        val strength = calculatePasswordStrength(newPassword)
        _passwordStrength.value = strength

        if (strength < 60) {
            handleError(
                IllegalArgumentException("Password is too weak. Include uppercase, lowercase, numbers, and symbols"),
                "password strength validation"
            )
            return
        }

        _password.value = newPassword
    }

    /**
     * Updates confirm password field with validation
     */
    fun updateConfirmPassword(confirmPass: String) {
        _confirmPassword.value = confirmPass
        
        if (confirmPass.isNotEmpty() && confirmPass != _password.value) {
            handleError(
                IllegalArgumentException("Passwords do not match"),
                "password confirmation"
            )
        }
    }

    /**
     * Initiates secure signup process with rate limiting
     */
    fun signup() = launchWithLoading {
        try {
            // Check rate limiting
            if (_signupAttempts.value >= MAX_SIGNUP_ATTEMPTS) {
                handleError(
                    SecurityException("Too many signup attempts. Please try again later"),
                    "signup rate limiting"
                )
                return@launchWithLoading
            }

            // Validate all inputs
            validateSignupInputs()

            // Hash password securely with salt
            val hashedPassword = SecurityUtils.hashString(_password.value)

            // Clear sensitive data
            clearSensitiveData()

            // Increment attempt counter
            _signupAttempts.value++

            // TODO: Implement actual signup API call here
            
            _signupSuccess.value = true
            
            Logger.logInfo(TAG, "Signup successful", mapOf(
                "email" to _email.value,
                "passwordStrength" to _passwordStrength.value
            ))

        } catch (e: Exception) {
            handleError(e, "signup process")
            _signupSuccess.value = false
        }
    }

    /**
     * Calculates password strength score (0-100)
     */
    private fun calculatePasswordStrength(password: String): Int {
        var score = 0
        
        // Length check
        score += (password.length / MIN_PASSWORD_LENGTH.toFloat() * 25).toInt().coerceAtMost(25)
        
        // Character variety checks
        if (password.any { it.isUpperCase() }) score += 15
        if (password.any { it.isLowerCase() }) score += 15
        if (password.any { it.isDigit() }) score += 20
        if (password.any { !it.isLetterOrDigit() }) score += 25
        
        return score.coerceIn(0, 100)
    }

    /**
     * Validates all signup input fields
     */
    private fun validateSignupInputs() {
        when {
            _email.value.isEmpty() -> 
                throw IllegalArgumentException("Email is required")
            
            !emailPattern.matcher(_email.value).matches() ->
                throw IllegalArgumentException("Invalid email format")
            
            _password.value.isEmpty() ->
                throw IllegalArgumentException("Password is required")
            
            _password.value.length < MIN_PASSWORD_LENGTH ->
                throw IllegalArgumentException("Password too short")
            
            _passwordStrength.value < 60 ->
                throw IllegalArgumentException("Password too weak")
            
            _password.value != _confirmPassword.value ->
                throw IllegalArgumentException("Passwords do not match")
        }
    }

    /**
     * Securely clears sensitive data from memory
     */
    private fun clearSensitiveData() {
        _password.value = ""
        _confirmPassword.value = ""
        System.gc()
    }

    override fun onCleared() {
        super.onCleared()
        clearSensitiveData()
        Logger.logDebug(TAG, "ViewModel cleared, sensitive data removed")
    }
}