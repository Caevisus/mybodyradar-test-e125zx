package com.smartapparel.app.presentation.auth

import android.os.Bundle // version: API 29+
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityEvent // version: API 29+
import android.view.inputmethod.EditorInfo
import androidx.core.view.AccessibilityDelegateCompat // version: 1.6.1
import androidx.core.view.ViewCompat // version: 1.6.1
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat // version: 1.6.1
import androidx.core.widget.doOnTextChanged
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope // version: 2.6.1
import androidx.navigation.fragment.findNavController
import com.google.android.material.button.MaterialButton // version: 1.9.0
import com.google.android.material.textfield.TextInputLayout // version: 1.9.0
import com.google.android.material.textfield.TextInputEditText // version: 1.9.0
import com.smartapparel.app.R
import com.smartapparel.app.databinding.FragmentSignupBinding
import com.smartapparel.app.presentation.common.BaseFragment
import com.smartapparel.app.utils.Logger
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

private const val TAG = "SignupFragment"

/**
 * Fragment responsible for user registration with Material Design 3.0 components,
 * WCAG 2.1 Level AA compliance, and secure data handling.
 */
class SignupFragment : BaseFragment<FragmentSignupBinding, SignupViewModel>() {

    override val viewModel: SignupViewModel by viewModels()
    private var _binding: FragmentSignupBinding? = null
    private val binding get() = _binding!!

    override fun createViewBinding(
        inflater: LayoutInflater,
        container: ViewGroup?
    ): FragmentSignupBinding {
        _binding = FragmentSignupBinding.inflate(inflater, container, false)
        return binding
    }

    override fun setupUI() {
        setupAccessibility()
        setupEmailInput()
        setupPasswordInput()
        setupConfirmPasswordInput()
        setupSignupButton()
        setupLoginLink()
    }

    private fun setupAccessibility() {
        ViewCompat.setAccessibilityDelegate(binding.root, object : AccessibilityDelegateCompat() {
            override fun onInitializeAccessibilityNodeInfo(
                host: View,
                info: AccessibilityNodeInfoCompat
            ) {
                super.onInitializeAccessibilityNodeInfo(host, info)
                info.roleDescription = getString(R.string.signup_form_description)
                info.isScreenReaderFocusable = true
            }
        })

        // Set content descriptions
        binding.apply {
            emailInput.contentDescription = getString(R.string.email_input_description)
            passwordInput.contentDescription = getString(R.string.password_input_description)
            confirmPasswordInput.contentDescription = getString(R.string.confirm_password_description)
            signupButton.contentDescription = getString(R.string.signup_button_description)
        }
    }

    private fun setupEmailInput() {
        binding.emailInput.apply {
            editText?.doOnTextChanged { text, _, _, _ ->
                viewModel.updateEmail(text.toString())
            }
            
            setEndIconOnClickListener {
                editText?.text?.clear()
                announceForAccessibility(getString(R.string.email_cleared))
            }

            editText?.setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_NEXT) {
                    binding.passwordInput.editText?.requestFocus()
                    true
                } else false
            }
        }
    }

    private fun setupPasswordInput() {
        binding.passwordInput.apply {
            editText?.doOnTextChanged { text, _, _, _ ->
                viewModel.updatePassword(text.toString())
            }

            setEndIconOnClickListener {
                isPasswordVisibilityToggleEnabled = !isPasswordVisibilityToggleEnabled
                announceForAccessibility(
                    getString(
                        if (isPasswordVisibilityToggleEnabled) 
                            R.string.password_visible 
                        else 
                            R.string.password_hidden
                    )
                )
            }

            editText?.setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_NEXT) {
                    binding.confirmPasswordInput.editText?.requestFocus()
                    true
                } else false
            }
        }
    }

    private fun setupConfirmPasswordInput() {
        binding.confirmPasswordInput.apply {
            editText?.doOnTextChanged { text, _, _, _ ->
                viewModel.updateConfirmPassword(text.toString())
            }

            setEndIconOnClickListener {
                isPasswordVisibilityToggleEnabled = !isPasswordVisibilityToggleEnabled
                announceForAccessibility(
                    getString(
                        if (isPasswordVisibilityToggleEnabled) 
                            R.string.password_visible 
                        else 
                            R.string.password_hidden
                    )
                )
            }

            editText?.setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_DONE) {
                    binding.signupButton.performClick()
                    true
                } else false
            }
        }
    }

    private fun setupSignupButton() {
        binding.signupButton.apply {
            setOnClickListener {
                isEnabled = false
                viewModel.signup()
            }
            
            ViewCompat.setAccessibilityDelegate(this, object : AccessibilityDelegateCompat() {
                override fun performAccessibilityAction(
                    host: View,
                    action: Int,
                    args: Bundle?
                ): Boolean {
                    if (action == AccessibilityNodeInfoCompat.ACTION_CLICK) {
                        announceForAccessibility(getString(R.string.signup_in_progress))
                    }
                    return super.performAccessibilityAction(host, action, args)
                }
            })
        }
    }

    private fun setupLoginLink() {
        binding.loginLink.apply {
            setOnClickListener {
                findNavController().navigate(R.id.action_signup_to_login)
            }
            
            ViewCompat.setAccessibilityDelegate(this, object : AccessibilityDelegateCompat() {
                override fun onInitializeAccessibilityNodeInfo(
                    host: View,
                    info: AccessibilityNodeInfoCompat
                ) {
                    super.onInitializeAccessibilityNodeInfo(host, info)
                    info.roleDescription = getString(R.string.login_link_description)
                    info.isClickable = true
                }
            })
        }
    }

    override fun setupObservers() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.email.collectLatest { email ->
                updateEmailValidation(email)
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.passwordStrength.collectLatest { strength ->
                updatePasswordStrengthIndicator(strength)
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.signupSuccess.collectLatest { success ->
                if (success) handleSignupSuccess()
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.isLoading.collectLatest { isLoading ->
                binding.signupButton.isEnabled = !isLoading
                binding.progressIndicator.visibility = if (isLoading) View.VISIBLE else View.GONE
            }
        }
    }

    private fun updateEmailValidation(email: String) {
        binding.emailInput.apply {
            error = when {
                email.isEmpty() -> null
                !android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches() ->
                    getString(R.string.invalid_email_format)
                else -> null
            }
            
            if (error != null) {
                announceForAccessibility(error)
            }
        }
    }

    private fun updatePasswordStrengthIndicator(strength: Int) {
        binding.passwordStrengthIndicator.apply {
            progress = strength
            contentDescription = getString(
                R.string.password_strength_description,
                strength
            )
        }

        binding.passwordInput.helperText = when {
            strength < 30 -> getString(R.string.password_strength_weak)
            strength < 60 -> getString(R.string.password_strength_medium)
            else -> getString(R.string.password_strength_strong)
        }
    }

    private fun handleSignupSuccess() {
        Logger.logInfo(TAG, "Signup successful, navigating to login")
        binding.root.announceForAccessibility(getString(R.string.signup_success))
        findNavController().navigate(
            R.id.action_signup_to_login,
            null,
            null,
            null
        )
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}