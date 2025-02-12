package com.smartapparel.app.presentation.common

import android.os.Bundle // version: API 29+
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.annotation.LayoutRes
import androidx.fragment.app.Fragment // version: 1.6.1
import androidx.lifecycle.lifecycleScope // version: 2.6.1
import androidx.viewbinding.ViewBinding // version: 8.1.1
import com.google.android.material.snackbar.Snackbar // version: 1.9.0
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import com.smartapparel.app.utils.Logger

private const val TAG = "BaseFragment"
private const val ERROR_DISPLAY_DURATION = 5000L
private const val ERROR_DISPLAY_DURATION_LONG = 8000L
private const val MAX_ERROR_LENGTH = 100

/**
 * Abstract base Fragment class providing comprehensive foundation for all Fragments
 * with efficient lifecycle management, thread-safe view binding, and structured error handling.
 *
 * @param VB ViewBinding type for type-safe view access
 * @param VM BaseViewModel type for state management
 */
abstract class BaseFragment<VB : ViewBinding, VM : BaseViewModel> constructor(
    @LayoutRes private val layoutId: Int
) : Fragment(layoutId) {

    private var _binding: VB? = null
    protected val binding: VB
        get() = _binding ?: throw IllegalStateException("View binding is only valid between onCreateView and onDestroyView")

    protected abstract val viewModel: VM

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        Logger.d(TAG, "Creating view for fragment: ${this::class.simpleName}")
        _binding = createViewBinding(inflater, container)
        return binding.root.apply {
            // Configure accessibility
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
            contentDescription = this::class.simpleName
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        Logger.d(TAG, "View created for fragment: ${this::class.simpleName}")

        // Observe loading state
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.isLoading.collectLatest { isLoading ->
                handleLoadingState(isLoading)
            }
        }

        // Observe error state
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.error.collectLatest { error ->
                error?.let { showError(it) }
            }
        }

        setupUI()
        setupObservers()
    }

    /**
     * Abstract method to create view binding instance.
     * Must be implemented by child classes to provide specific binding implementation.
     */
    protected abstract fun createViewBinding(
        inflater: LayoutInflater,
        container: ViewGroup?
    ): VB

    /**
     * Abstract method for setting up UI components and interactions.
     * Child classes must implement this to configure their specific UI elements.
     */
    protected abstract fun setupUI()

    /**
     * Abstract method for setting up data observers and state handling.
     * Child classes must implement this to observe their specific data streams.
     */
    protected abstract fun setupObservers()

    /**
     * Handles loading state changes with proper UI feedback.
     * Override in child classes for custom loading behavior.
     */
    protected open fun handleLoadingState(isLoading: Boolean) {
        // Default implementation - override for custom loading UI
        Logger.d(TAG, "Loading state changed: $isLoading")
    }

    /**
     * Shows error message using Material Snackbar with accessibility support
     * and automatic timeout based on message length.
     */
    protected fun showError(message: String) {
        Logger.e(TAG, "Showing error: $message")
        
        val duration = if (message.length > MAX_ERROR_LENGTH) {
            ERROR_DISPLAY_DURATION_LONG
        } else {
            ERROR_DISPLAY_DURATION
        }

        view?.let { view ->
            Snackbar.make(
                view,
                message,
                Snackbar.LENGTH_LONG
            ).apply {
                // Configure accessibility
                view.contentDescription = "Error: $message"
                view.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
                
                // Set duration based on message length
                setDuration(duration.toInt())
                
                // Add retry action if applicable
                setAction("Retry") {
                    Logger.d(TAG, "Retry action triggered for error: $message")
                    handleErrorRetry()
                }
                
                // Show the snackbar
                show()
            }
        }
    }

    /**
     * Handles retry action for errors.
     * Override in child classes for specific retry behavior.
     */
    protected open fun handleErrorRetry() {
        // Default implementation - override for specific retry logic
        Logger.d(TAG, "Default error retry handler")
    }

    override fun onDestroyView() {
        Logger.d(TAG, "Destroying view for fragment: ${this::class.simpleName}")
        _binding = null
        super.onDestroyView()
    }
}