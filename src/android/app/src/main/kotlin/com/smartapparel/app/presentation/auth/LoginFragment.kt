package com.smartapparel.app.presentation.auth

import android.os.Bundle // version: API 29+
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import androidx.biometric.BiometricManager // version: 1.2.0
import androidx.biometric.BiometricPrompt // version: 1.2.0
import androidx.core.content.ContextCompat
import androidx.core.widget.doAfterTextChanged
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.google.android.material.textfield.TextInputLayout // version: 1.9.0
import com.smartapparel.app.R
import com.smartapparel.app.databinding.FragmentLoginBinding // version: 8.1.1
import com.smartapparel.app.presentation.common.BaseFragment
import com.smartapparel.app.utils.Logger
import dagger.hilt.android.AndroidEntryPoint // version: 2.48
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

private const val TAG = "LoginFragment"
private const val DEBOUNCE_DURATION = 300L

/**
 * Fragment responsible for handling secure user login with biometric authentication support
 * and Material Design 3.0 components.
 */
@AndroidEntryPoint
class LoginFragment : BaseFragment<FragmentLoginBinding, LoginViewModel>() {

    @Inject
    lateinit var biometricManager: BiometricManager

    private val viewModel: LoginViewModel by viewModels()
    private lateinit var biometricPrompt: BiometricPrompt

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        // Prevent screen capture for security
        requireActivity().window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )
        return super.onCreateView(inflater, container, savedInstanceState)
    }

    override fun createViewBinding(
        inflater: LayoutInflater,
        container: ViewGroup?
    ): FragmentLoginBinding = FragmentLoginBinding.inflate(inflater, container, false)

    override fun setupUI() {
        Logger.d(TAG, "Setting up login UI")

        with(binding) {
            // Configure email input with validation
            emailInput.apply {
                doAfterTextChanged { text ->
                    viewModel.updateEmail(text?.toString() ?: "")
                    emailInputLayout.error = null
                }
                importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_YES
                contentDescription = getString(R.string.email_input_content_description)
            }

            // Configure password input with security features
            passwordInput.apply {
                doAfterTextChanged { text ->
                    viewModel.updatePassword(text?.toString() ?: "")
                    passwordInputLayout.error = null
                }
                importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO
                contentDescription = getString(R.string.password_input_content_description)
            }

            // Configure login button with accessibility
            loginButton.apply {
                setOnClickListener {
                    viewModel.login()
                }
                contentDescription = getString(R.string.login_button_content_description)
            }

            // Configure biometric login if available
            biometricLoginButton.apply {
                setupBiometricLogin()
                contentDescription = getString(R.string.biometric_login_button_content_description)
            }

            // Configure progress indicator
            loginProgress.apply {
                hide()
                setVisibilityAfterHide(View.GONE)
            }
        }
    }

    override fun setupObservers() {
        Logger.d(TAG, "Setting up login observers")

        viewLifecycleOwner.lifecycleScope.launch {
            // Observe login button state
            viewModel.isLoginEnabled.collectLatest { isEnabled ->
                binding.loginButton.isEnabled = isEnabled
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            // Observe biometric availability
            viewModel.isBiometricAvailable.collectLatest { isAvailable ->
                binding.biometricLoginButton.visibility = 
                    if (isAvailable) View.VISIBLE else View.GONE
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            // Observe account lockout state
            viewModel.isLocked.collectLatest { isLocked ->
                binding.loginButton.isEnabled = !isLocked
                if (isLocked) {
                    showError(getString(R.string.account_locked_message))
                }
            }
        }
    }

    override fun handleLoadingState(isLoading: Boolean) {
        with(binding) {
            if (isLoading) {
                loginProgress.show()
                loginButton.isEnabled = false
                biometricLoginButton.isEnabled = false
            } else {
                loginProgress.hide()
                loginButton.isEnabled = viewModel.isLoginEnabled.value
                biometricLoginButton.isEnabled = viewModel.isBiometricAvailable.value
            }
        }
    }

    private fun setupBiometricLogin() {
        val executor = ContextCompat.getMainExecutor(requireContext())
        
        biometricPrompt = BiometricPrompt(
            this,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    Logger.i(TAG, "Biometric authentication succeeded")
                    viewModel.loginWithBiometrics()
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    Logger.e(TAG, "Biometric authentication error", null, mapOf(
                        "errorCode" to errorCode,
                        "errorMessage" to errString.toString()
                    ))
                    showError(errString.toString())
                }
            }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(getString(R.string.biometric_prompt_title))
            .setSubtitle(getString(R.string.biometric_prompt_subtitle))
            .setNegativeButtonText(getString(R.string.biometric_prompt_negative_button))
            .setConfirmationRequired(true)
            .build()

        binding.biometricLoginButton.setOnClickListener {
            biometricPrompt.authenticate(promptInfo)
        }
    }

    override fun handleErrorRetry() {
        viewModel.login()
    }

    companion object {
        fun newInstance() = LoginFragment()
    }
}