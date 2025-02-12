import UIKit // latest
import Combine // latest
import LocalAuthentication // latest

/// View controller responsible for displaying and managing user profile information with enhanced security,
/// accessibility, and performance features compliant with WCAG 2.1 Level AA standards.
@MainActor
public final class ProfileViewController: UIViewController {
    
    // MARK: - Private Properties
    
    private let viewModel: ProfileViewModel
    private let loadingView: LoadingView
    private let scrollView = UIScrollView()
    private let contentStack = UIStackView()
    private let nameField = SecureTextField()
    private let emailField = SecureTextField()
    private let preferencesButton = AccessibleButton()
    private let securityButton = AccessibleButton()
    private let biometricButton = AccessibleButton()
    private var cancellables = Set<AnyCancellable>()
    private let securityContext = LAContext()
    
    // MARK: - Initialization
    
    public init() {
        self.viewModel = ProfileViewModel()
        self.loadingView = LoadingView(message: NSLocalizedString("Loading Profile", comment: ""))
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle Methods
    
    public override func viewDidLoad() {
        super.viewDidLoad()
        setupSecureUI()
        setupSecureBindings()
        
        // Load initial profile data with performance tracking
        let startTime = CACurrentMediaTime()
        Task {
            await viewModel.loadUserProfile()
            let loadTime = CACurrentMediaTime() - startTime
            assert(loadTime <= kMaxUpdateLatency, "Profile load time exceeded maximum latency")
        }
    }
    
    // MARK: - Private Methods
    
    private func setupSecureUI() {
        view.backgroundColor = .background
        
        // Configure scroll view
        view.addSubview(scrollView)
        scrollView.anchor()
        scrollView.fillSuperview()
        
        // Configure content stack
        scrollView.addSubview(contentStack)
        contentStack.anchor()
        contentStack.fillSuperview(padding: UIEdgeInsets(top: kProfileSectionSpacing,
                                                       left: kProfileSectionSpacing,
                                                       bottom: kProfileSectionSpacing,
                                                       right: kProfileSectionSpacing))
        contentStack.axis = .vertical
        contentStack.spacing = kProfileSectionSpacing
        
        // Configure secure text fields
        nameField.placeholder = NSLocalizedString("Full Name", comment: "")
        nameField.textContentType = .name
        nameField.returnKeyType = .next
        nameField.accessibilityLabel = NSLocalizedString("Full Name Field", comment: "")
        nameField.constrainHeight(kProfileFieldHeight)
        
        emailField.placeholder = NSLocalizedString("Email", comment: "")
        emailField.textContentType = .emailAddress
        emailField.keyboardType = .emailAddress
        emailField.returnKeyType = .done
        emailField.accessibilityLabel = NSLocalizedString("Email Field", comment: "")
        emailField.constrainHeight(kProfileFieldHeight)
        
        // Configure buttons
        preferencesButton.setTitle(NSLocalizedString("Preferences", comment: ""), for: .normal)
        preferencesButton.accessibilityHint = NSLocalizedString("Configure app preferences", comment: "")
        
        securityButton.setTitle(NSLocalizedString("Security Settings", comment: ""), for: .normal)
        securityButton.accessibilityHint = NSLocalizedString("Manage security settings", comment: "")
        
        biometricButton.setTitle(NSLocalizedString("Enable Biometric Auth", comment: ""), for: .normal)
        biometricButton.accessibilityHint = NSLocalizedString("Set up biometric authentication", comment: "")
        
        // Add components to stack
        [nameField, emailField, preferencesButton, securityButton, biometricButton].forEach {
            contentStack.addArrangedSubview($0)
        }
        
        // Add loading view
        view.addSubview(loadingView)
        loadingView.anchor()
        loadingView.fillSuperview()
        
        setupAccessibilityGrouping()
    }
    
    private func setupSecureBindings() {
        // Bind view state
        viewModel.$viewState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                guard let self = self else { return }
                switch state {
                case .loading:
                    self.loadingView.startAnimating()
                case .loaded:
                    self.loadingView.stopAnimating()
                case .error(let error):
                    self.loadingView.stopAnimating()
                    self.handleError(error)
                }
            }
            .store(in: &cancellables)
        
        // Bind user data with encryption
        viewModel.$user
            .receive(on: DispatchQueue.main)
            .sink { [weak self] user in
                guard let self = self, let user = user else { return }
                
                Task {
                    do {
                        let decryptedName = try SecurityUtils.decryptField(user.name, key: kEncryptionKey)
                        let decryptedEmail = try SecurityUtils.decryptField(user.email, key: kEncryptionKey)
                        
                        self.nameField.text = decryptedName
                        self.emailField.text = decryptedEmail
                    } catch {
                        self.handleError(.securityError)
                    }
                }
            }
            .store(in: &cancellables)
        
        // Setup field validation and secure updates
        nameField.textDidChangePublisher
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] name in
                guard let self = self else { return }
                Task {
                    do {
                        let encryptedName = try SecurityUtils.encryptField(name, key: kEncryptionKey)
                        await self.viewModel.updateProfile(firstName: encryptedName, lastName: "")
                    } catch {
                        self.handleError(.validationError)
                    }
                }
            }
            .store(in: &cancellables)
        
        // Setup button actions
        preferencesButton.addTarget(self, action: #selector(showPreferences), for: .touchUpInside)
        securityButton.addTarget(self, action: #selector(showSecuritySettings), for: .touchUpInside)
        biometricButton.addTarget(self, action: #selector(configureBiometrics), for: .touchUpInside)
    }
    
    private func setupAccessibilityGrouping() {
        let profileGroup = UIAccessibilityElement(accessibilityContainer: contentStack)
        profileGroup.accessibilityLabel = NSLocalizedString("Profile Information", comment: "")
        profileGroup.accessibilityFrameInContainerSpace = contentStack.bounds
        
        contentStack.accessibilityElements = [nameField, emailField, preferencesButton, securityButton, biometricButton]
        
        // Configure voice over reading order
        UIAccessibility.post(notification: .screenChanged, argument: profileGroup)
    }
    
    private func handleError(_ error: ProfileError) {
        let title = NSLocalizedString("Error", comment: "")
        let message: String
        
        switch error {
        case .sessionExpired:
            message = NSLocalizedString("Your session has expired. Please log in again.", comment: "")
        case .networkError:
            message = NSLocalizedString("Unable to connect to the server. Please try again.", comment: "")
        case .validationError:
            message = NSLocalizedString("Please check your input and try again.", comment: "")
        case .securityError:
            message = NSLocalizedString("A security error occurred. Please try again.", comment: "")
        case .storageError:
            message = NSLocalizedString("Unable to save your changes. Please try again.", comment: "")
        }
        
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: NSLocalizedString("OK", comment: ""), style: .default))
        present(alert, animated: true)
    }
    
    // MARK: - Action Methods
    
    @objc private func showPreferences() {
        // Implementation for showing preferences
    }
    
    @objc private func showSecuritySettings() {
        // Implementation for showing security settings
    }
    
    @objc private func configureBiometrics() {
        Task {
            do {
                let canUseBiometrics = try await viewModel.validateBiometrics()
                if canUseBiometrics {
                    // Implementation for biometric setup
                }
            } catch {
                handleError(.securityError)
            }
        }
    }
}

// MARK: - Supporting Types

private class SecureTextField: UITextField {
    var textDidChangePublisher: AnyPublisher<String, Never> {
        NotificationCenter.default.publisher(for: UITextField.textDidChangeNotification, object: self)
            .compactMap { ($0.object as? UITextField)?.text }
            .eraseToAnyPublisher()
    }
}

private class AccessibleButton: UIButton {
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupAccessibility()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupAccessibility()
    }
    
    private func setupAccessibility() {
        isAccessibilityElement = true
        accessibilityTraits = .button
        constrainHeight(AppConstants.UI_CONFIG.MINIMUM_TARGET_SIZE)
    }
}