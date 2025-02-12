package com.smartapparel.app.presentation.auth

import androidx.lifecycle.viewModelScope // version: 2.6.1
import com.smartapparel.app.domain.auth.AuthRepository // version: 1.0.0
import com.smartapparel.app.presentation.common.BaseViewModel
import com.smartapparel.app.utils.SecurityUtils
import com.smartapparel.app.utils.Logger
import kotlinx.coroutines.flow.MutableStateFlow // version: 1.7.1
import kotlinx.coroutines.flow.StateFlow // version: 1.7.1
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce // version: 1.7.1
import kotlinx.coroutines.launch
import javax.inject.Inject // version: 1

private const val TAG = "LoginViewModel"
private const val VALIDATION_DEBOUNCE_MS = 100L
private const val MAX_LOGIN_ATTEMPTS = 3
private const val LOCKOUT_DURATION_MS = 300000L // 5 minutes

/**
 * ViewModel responsible for handling secure login business logic and state management
 * with real-time validation and enhanced security features.
 */
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : BaseViewModel() {

    // Form state management
    private val _email = MutableStateFlow("")
    val email: StateFlow<String> = _email.asStateFlow()

    private val _password = MutableStateFlow("")
    val password: StateFlow<String> = _password.asStateFlow()

    private val _isLoginEnabled = MutableStateFlow(false)
    val isLoginEnabled: StateFlow<Boolean> = _isLoginEnabled.asStateFlow()

    // Security state management
    private val _isBiometricAvailable = MutableStateFlow(false)
    val isBiometricAvailable: StateFlow<Boolean> = _isBiometricAvailable.asStateFlow()

    private val _loginAttempts = MutableStateFlow(0)
    private val _isLocked = MutableStateFlow(false)
    val isLocked: StateFlow<Boolean> = _isLocked.asStateFlow()

    init {
        // Setup form validation with debouncing for performance
        viewModelScope.launch {
            _email.debounce(VALIDATION_DEBOUNCE_MS)
                .collect { validateForm() }
        }

        viewModelScope.launch {
            _password.debounce(VALIDATION_DEBOUNCE_MS)
                .collect { validateForm() }
        }

        // Check biometric availability
        viewModelScope.launch {
            _isBiometricAvailable.value = authRepository.isBiometricAvailable()
        }
    }

    /**
     * Updates email with validation and security checks
     */
    fun updateEmail(email: String) {
        _email.value = email.trim()
        Logger.d(TAG, "Email updated", mapOf("emailLength" to email.length))
    }

    /**
     * Updates password with strength validation
     */
    fun updatePassword(password: String) {
        _password.value = password
        Logger.d(TAG, "Password updated", mapOf("passwordLength" to password.length))
    }

    /**
     * Performs secure login with rate limiting and enhanced security
     */
    fun login() = launchWithLoading {
        try {
            if (_isLocked.value) {
                handleError(SecurityException("Account is temporarily locked"), "login")
                return@launchWithLoading
            }

            if (!validateForm()) {
                handleError(IllegalStateException("Invalid form state"), "login")
                return@launchWithLoading
            }

            // Increment attempt counter
            _loginAttempts.value++

            // Perform login
            val result = authRepository.login(
                email = _email.value,
                passwordHash = SecurityUtils.hashString(_password.value)
            )

            if (result.isSuccess) {
                // Reset security counters on success
                _loginAttempts.value = 0
                _isLocked.value = false
                Logger.i(TAG, "Login successful", mapOf("email" to _email.value))
            } else {
                handleLoginFailure()
            }
        } catch (e: Exception) {
            handleLoginFailure()
            handleError(e, "login")
        }
    }

    /**
     * Handles biometric authentication
     */
    fun loginWithBiometrics() = launchWithLoading {
        try {
            if (!_isBiometricAvailable.value) {
                handleError(IllegalStateException("Biometric authentication not available"), "biometric login")
                return@launchWithLoading
            }

            val result = authRepository.loginWithBiometrics()
            
            if (result.isSuccess) {
                Logger.i(TAG, "Biometric login successful")
            } else {
                handleError(SecurityException("Biometric authentication failed"), "biometric login")
            }
        } catch (e: Exception) {
            handleError(e, "biometric login")
        }
    }

    /**
     * Validates form input with comprehensive checks
     */
    private fun validateForm(): Boolean {
        val isEmailValid = _email.value.matches(Regex("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,6}$"))
        val isPasswordValid = _password.value.length >= 8 &&
                _password.value.matches(Regex("^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=]).*$"))

        _isLoginEnabled.value = isEmailValid && isPasswordValid && !_isLocked.value

        Logger.d(TAG, "Form validation", mapOf(
            "isEmailValid" to isEmailValid,
            "isPasswordValid" to isPasswordValid,
            "isLoginEnabled" to _isLoginEnabled.value
        ))

        return _isLoginEnabled.value
    }

    /**
     * Handles failed login attempts with rate limiting
     */
    private fun handleLoginFailure() {
        if (_loginAttempts.value >= MAX_LOGIN_ATTEMPTS) {
            _isLocked.value = true
            Logger.w(TAG, "Account locked due to multiple failed attempts", mapOf(
                "attempts" to _loginAttempts.value
            ))

            // Schedule unlock
            viewModelScope.launch {
                kotlinx.coroutines.delay(LOCKOUT_DURATION_MS)
                _isLocked.value = false
                _loginAttempts.value = 0
                Logger.i(TAG, "Account unlocked after timeout")
            }
        }
    }
}