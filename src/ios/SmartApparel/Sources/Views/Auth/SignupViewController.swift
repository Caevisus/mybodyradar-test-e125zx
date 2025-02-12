import UIKit // latest
import Combine // latest

/// View controller managing the user signup flow with OAuth 2.0 integration, biometric setup,
/// and WCAG 2.1 Level AA accessibility compliance
@available(iOS 14.0, *)
public protocol SignupViewControllerDelegate: AnyObject {
    func didCompleteSignup()
}

public final class SignupViewController: UIViewController {
    
    // MARK: - Properties
    
    private let viewModel: AuthViewModel
    private let loadingView: LoadingView
    private var cancellables = Set<AnyCancellable>()
    
    private let emailTextField: UITextField = {
        let textField = UITextField()
        textField.placeholder = NSLocalizedString("Email", comment: "Email field placeholder")
        textField.keyboardType = .emailAddress
        textField.autocapitalizationType = .none
        textField.autocorrectionType = .no
        textField.returnKeyType = .next
        textField.borderStyle = .roundedRect
        textField.accessibilityLabel = NSLocalizedString("Email Address", comment: "Email field accessibility label")
        return textField
    }()
    
    private let passwordTextField: UITextField = {
        let textField = UITextField()
        textField.placeholder = NSLocalizedString("Password", comment: "Password field placeholder")
        textField.isSecureTextEntry = true
        textField.returnKeyType = .next
        textField.borderStyle = .roundedRect
        textField.accessibilityLabel = NSLocalizedString("Password", comment: "Password field accessibility label")
        return textField
    }()
    
    private let confirmPasswordTextField: UITextField = {
        let textField = UITextField()
        textField.placeholder = NSLocalizedString("Confirm Password", comment: "Confirm password field placeholder")
        textField.isSecureTextEntry = true
        textField.returnKeyType = .done
        textField.borderStyle = .roundedRect
        textField.accessibilityLabel = NSLocalizedString("Confirm Password", comment: "Confirm password field accessibility label")
        return textField
    }()
    
    private let signupButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle(NSLocalizedString("Sign Up", comment: "Sign up button title"), for: .normal)
        button.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        button.backgroundColor = .accent
        button.setTitleColor(.white, for: .normal)
        button.layer.cornerRadius = AppConstants.UI_CONFIG.CORNER_RADIUS
        button.isEnabled = false
        return button
    }()
    
    private let biometricSetupSwitch: UISwitch = {
        let toggle = UISwitch()
        toggle.isOn = false
        toggle.accessibilityLabel = NSLocalizedString("Enable Biometric Login", comment: "Biometric toggle accessibility label")
        return toggle
    }()
    
    private let validationDebouncer = Debouncer(delay: 0.3)
    private let rateLimiter = SignupRateLimiter(maxAttempts: AppConstants.SESSION_CONFIG.MAX_FAILED_AUTH_ATTEMPTS)
    
    public weak var delegate: SignupViewControllerDelegate?
    
    // MARK: - Initialization
    
    public init(viewModel: AuthViewModel) {
        self.viewModel = viewModel
        self.loadingView = LoadingView(message: NSLocalizedString("Creating Account...", comment: "Signup loading message"))
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle
    
    public override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupBindings()
        setupAccessibility()
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        view.backgroundColor = .background
        
        let stackView = UIStackView()
        stackView.axis = .vertical
        stackView.spacing = AppConstants.UI_CONFIG.DEFAULT_PADDING
        stackView.alignment = .fill
        stackView.distribution = .fillEqually
        
        [emailTextField, passwordTextField, confirmPasswordTextField].forEach {
            stackView.addArrangedSubview($0)
            $0.heightAnchor.constraint(equalToConstant: AppConstants.UI_CONFIG.MINIMUM_TARGET_SIZE).isActive = true
        }
        
        let biometricContainer = UIStackView()
        biometricContainer.axis = .horizontal
        biometricContainer.spacing = AppConstants.UI_CONFIG.DEFAULT_PADDING
        biometricContainer.alignment = .center
        
        let biometricLabel = UILabel()
        biometricLabel.text = NSLocalizedString("Enable Biometric Login", comment: "Biometric setup label")
        biometricLabel.font = .preferredFont(forTextStyle: .body)
        biometricLabel.textColor = .text
        biometricLabel.adjustsFontForContentSizeCategory = true
        
        biometricContainer.addArrangedSubview(biometricLabel)
        biometricContainer.addArrangedSubview(biometricSetupSwitch)
        
        stackView.addArrangedSubview(biometricContainer)
        stackView.addArrangedSubview(signupButton)
        
        view.addSubview(stackView)
        view.addSubview(loadingView)
        
        stackView.anchor()
        stackView.centerInSuperview()
        stackView.constrainWidth(view.bounds.width - 2 * AppConstants.UI_CONFIG.DEFAULT_PADDING)
        
        loadingView.anchor()
        loadingView.fillSuperview()
        loadingView.isHidden = true
        
        signupButton.addTarget(self, action: #selector(handleSignup), for: .touchUpInside)
    }
    
    private func setupBindings() {
        // Input validation binding
        let emailPublisher = NotificationCenter.default.publisher(for: UITextField.textDidChangeNotification, object: emailTextField)
        let passwordPublisher = NotificationCenter.default.publisher(for: UITextField.textDidChangeNotification, object: passwordTextField)
        let confirmPasswordPublisher = NotificationCenter.default.publisher(for: UITextField.textDidChangeNotification, object: confirmPasswordTextField)
        
        Publishers.CombineLatest3(emailPublisher, passwordPublisher, confirmPasswordPublisher)
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.validateInput()
            }
            .store(in: &cancellables)
        
        // Loading state binding
        viewModel.$isLoading
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isLoading in
                if isLoading {
                    self?.loadingView.startAnimating()
                } else {
                    self?.loadingView.stopAnimating()
                }
            }
            .store(in: &cancellables)
    }
    
    private func setupAccessibility() {
        view.accessibilityViewIsModal = true
        
        emailTextField.accessibilityHint = NSLocalizedString("Enter your email address", comment: "Email field accessibility hint")
        passwordTextField.accessibilityHint = NSLocalizedString("Enter a secure password with at least 8 characters", comment: "Password field accessibility hint")
        confirmPasswordTextField.accessibilityHint = NSLocalizedString("Confirm your password", comment: "Confirm password field accessibility hint")
        
        signupButton.accessibilityTraits = .button
        signupButton.accessibilityHint = NSLocalizedString("Double tap to create account", comment: "Sign up button accessibility hint")
        
        biometricSetupSwitch.accessibilityHint = NSLocalizedString("Enable or disable biometric login after signup", comment: "Biometric toggle accessibility hint")
    }
    
    // MARK: - Actions
    
    @objc private func handleSignup() {
        guard rateLimiter.canAttemptSignup() else {
            presentError(message: NSLocalizedString("Too many attempts. Please try again later.", comment: "Rate limit error message"))
            return
        }
        
        guard validateInput() else { return }
        
        Task {
            do {
                try await viewModel.signup(
                    email: emailTextField.text ?? "",
                    password: passwordTextField.text ?? "",
                    enableBiometrics: biometricSetupSwitch.isOn
                )
                
                delegate?.didCompleteSignup()
            } catch {
                rateLimiter.recordFailedAttempt()
                presentError(message: error.localizedDescription)
            }
        }
    }
    
    // MARK: - Validation
    
    private func validateInput() -> Bool {
        guard let email = emailTextField.text,
              let password = passwordTextField.text,
              let confirmPassword = confirmPasswordTextField.text else {
            return false
        }
        
        let isValid = viewModel.validateInput(
            email: email,
            password: password,
            confirmPassword: confirmPassword
        )
        
        signupButton.isEnabled = isValid
        signupButton.alpha = isValid ? 1.0 : 0.5
        
        return isValid
    }
    
    // MARK: - Error Handling
    
    private func presentError(message: String) {
        let alert = UIAlertController(
            title: NSLocalizedString("Error", comment: "Error alert title"),
            message: message,
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(
            title: NSLocalizedString("OK", comment: "Error alert dismiss button"),
            style: .default
        ))
        
        present(alert, animated: true)
        
        // Announce error for VoiceOver
        UIAccessibility.post(notification: .announcement, argument: message)
    }
}

// MARK: - Rate Limiting

private class SignupRateLimiter {
    private let maxAttempts: Int
    private var attempts: Int = 0
    private var lastAttemptTime: Date?
    
    init(maxAttempts: Int) {
        self.maxAttempts = maxAttempts
    }
    
    func canAttemptSignup() -> Bool {
        guard let lastAttempt = lastAttemptTime else { return true }
        
        if Date().timeIntervalSince(lastAttempt) > AppConstants.SESSION_CONFIG.LOCKOUT_DURATION_MINUTES * 60 {
            attempts = 0
            return true
        }
        
        return attempts < maxAttempts
    }
    
    func recordFailedAttempt() {
        attempts += 1
        lastAttemptTime = Date()
    }
}

// MARK: - Debouncer

private class Debouncer {
    private let delay: TimeInterval
    private var workItem: DispatchWorkItem?
    
    init(delay: TimeInterval) {
        self.delay = delay
    }
    
    func debounce(_ action: @escaping () -> Void) {
        workItem?.cancel()
        workItem = DispatchWorkItem { action() }
        
        if let workItem = workItem {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: workItem)
        }
    }
}