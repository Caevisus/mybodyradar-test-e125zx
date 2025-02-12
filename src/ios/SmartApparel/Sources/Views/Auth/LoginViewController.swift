import UIKit // latest
import Combine // latest
import LocalAuthentication // latest

/// Enterprise-grade view controller responsible for secure user authentication with multi-factor support
@available(iOS 14.0, *)
final class LoginViewController: UIViewController {
    
    // MARK: - Private Properties
    
    private let viewModel: AuthViewModel
    private var cancellables = Set<AnyCancellable>()
    
    // UI Components
    private lazy var scrollView: UIScrollView = {
        let scrollView = UIScrollView()
        scrollView.keyboardDismissMode = .interactive
        return scrollView.anchor()
    }()
    
    private lazy var contentStack: UIStackView = {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = AppConstants.UI_CONFIG.DEFAULT_PADDING
        stack.alignment = .fill
        stack.distribution = .fill
        return stack.anchor()
    }()
    
    private lazy var logoImageView: UIImageView = {
        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFit
        imageView.tintColor = .primary
        imageView.isAccessibilityElement = true
        imageView.accessibilityLabel = "Smart Apparel Logo"
        return imageView.anchor()
    }()
    
    private lazy var emailTextField: SecureTextField = {
        let textField = SecureTextField()
        textField.placeholder = "Email"
        textField.keyboardType = .emailAddress
        textField.autocapitalizationType = .none
        textField.autocorrectionType = .no
        textField.returnKeyType = .next
        textField.accessibilityLabel = "Email Address"
        return textField.anchor()
    }()
    
    private lazy var passwordTextField: SecureTextField = {
        let textField = SecureTextField()
        textField.placeholder = "Password"
        textField.isSecureTextEntry = true
        textField.returnKeyType = .done
        textField.accessibilityLabel = "Password"
        return textField.anchor()
    }()
    
    private lazy var loginButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("Log In", for: .normal)
        button.backgroundColor = .primary
        button.setTitleColor(.white, for: .normal)
        button.layer.cornerRadius = AppConstants.UI_CONFIG.CORNER_RADIUS
        button.addTarget(self, action: #selector(loginTapped), for: .touchUpInside)
        button.accessibilityLabel = "Log In"
        button.accessibilityTraits = .button
        return button.anchor()
    }()
    
    private lazy var biometricButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("Use Face ID", for: .normal)
        button.backgroundColor = .secondary
        button.setTitleColor(.white, for: .normal)
        button.layer.cornerRadius = AppConstants.UI_CONFIG.CORNER_RADIUS
        button.addTarget(self, action: #selector(biometricLoginTapped), for: .touchUpInside)
        button.accessibilityLabel = "Use Face ID for login"
        button.accessibilityTraits = .button
        return button.anchor()
    }()
    
    private lazy var activityIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .large)
        indicator.hidesWhenStopped = true
        return indicator.anchor()
    }()
    
    private lazy var errorLabel: UILabel = {
        let label = UILabel()
        label.textColor = .error
        label.textAlignment = .center
        label.numberOfLines = 0
        label.font = .preferredFont(forTextStyle: .footnote)
        label.isAccessibilityElement = true
        return label.anchor()
    }()
    
    // MARK: - Initialization
    
    init(viewModel: AuthViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle Methods
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupBindings()
        checkBiometricAvailability()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        registerForKeyboardNotifications()
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        removeKeyboardNotifications()
    }
    
    // MARK: - Private Methods
    
    private func setupUI() {
        view.backgroundColor = .systemBackground
        
        // Add scroll view
        view.addSubview(scrollView)
        scrollView.fillSuperview()
        
        // Add content stack
        scrollView.addSubview(contentStack)
        contentStack.fillSuperview()
        contentStack.widthAnchor.constraint(equalTo: scrollView.widthAnchor).isActive = true
        
        // Add UI components to stack
        [logoImageView, emailTextField, passwordTextField, loginButton, 
         biometricButton, activityIndicator, errorLabel].forEach {
            contentStack.addArrangedSubview($0)
        }
        
        // Configure component constraints
        NSLayoutConstraint.activate([
            logoImageView.heightAnchor.constraint(equalToConstant: 120),
            emailTextField.heightAnchor.constraint(equalToConstant: 44),
            passwordTextField.heightAnchor.constraint(equalToConstant: 44),
            loginButton.heightAnchor.constraint(equalToConstant: 44),
            biometricButton.heightAnchor.constraint(equalToConstant: 44)
        ])
        
        // Add padding
        contentStack.setCustomSpacing(40, after: logoImageView)
        contentStack.setCustomSpacing(24, after: passwordTextField)
        contentStack.setCustomSpacing(16, after: loginButton)
        
        // Configure content layout guide
        let contentGuide = scrollView.contentLayoutGuide
        contentStack.leadingAnchor.constraint(equalTo: contentGuide.leadingAnchor, constant: 24).isActive = true
        contentStack.trailingAnchor.constraint(equalTo: contentGuide.trailingAnchor, constant: -24).isActive = true
        contentStack.topAnchor.constraint(equalTo: contentGuide.topAnchor, constant: 48).isActive = true
        contentStack.bottomAnchor.constraint(equalTo: contentGuide.bottomAnchor, constant: -24).isActive = true
    }
    
    private func setupBindings() {
        // Bind loading state
        viewModel.$isLoading
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isLoading in
                self?.updateLoadingState(isLoading)
            }
            .store(in: &cancellables)
        
        // Bind error state
        viewModel.$error
            .receive(on: DispatchQueue.main)
            .sink { [weak self] error in
                self?.handleError(error)
            }
            .store(in: &cancellables)
    }
    
    private func checkBiometricAvailability() {
        let context = LAContext()
        var error: NSError?
        
        let canUseBiometrics = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        biometricButton.isHidden = !canUseBiometrics
    }
    
    private func updateLoadingState(_ isLoading: Bool) {
        if isLoading {
            activityIndicator.startAnimating()
            loginButton.isEnabled = false
            biometricButton.isEnabled = false
            emailTextField.isEnabled = false
            passwordTextField.isEnabled = false
        } else {
            activityIndicator.stopAnimating()
            loginButton.isEnabled = true
            biometricButton.isEnabled = true
            emailTextField.isEnabled = true
            passwordTextField.isEnabled = true
        }
    }
    
    private func handleError(_ error: AuthViewModelError?) {
        if let error = error {
            errorLabel.text = error.localizedDescription
            UIAccessibility.post(notification: .announcement, argument: error.localizedDescription)
        } else {
            errorLabel.text = nil
        }
    }
    
    private func navigateToDashboard() {
        let dashboardVC = DashboardViewController()
        let navigationController = UINavigationController(rootViewController: dashboardVC)
        navigationController.modalPresentationStyle = .fullScreen
        present(navigationController, animated: true)
    }
    
    // MARK: - Actions
    
    @objc private func loginTapped() {
        guard let email = emailTextField.text, !email.isEmpty,
              let password = passwordTextField.text, !password.isEmpty else {
            handleError(.invalidInput)
            return
        }
        
        Task {
            await viewModel.login(email: email, password: password)
            if viewModel.error == nil {
                navigateToDashboard()
            }
        }
    }
    
    @objc private func biometricLoginTapped() {
        Task {
            await viewModel.loginWithBiometrics()
            if viewModel.error == nil {
                navigateToDashboard()
            }
        }
    }
    
    // MARK: - Keyboard Handling
    
    private func registerForKeyboardNotifications() {
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillShow(_:)), 
                                             name: UIResponder.keyboardWillShowNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillHide(_:)), 
                                             name: UIResponder.keyboardWillHideNotification, object: nil)
    }
    
    private func removeKeyboardNotifications() {
        NotificationCenter.default.removeObserver(self, name: UIResponder.keyboardWillShowNotification, object: nil)
        NotificationCenter.default.removeObserver(self, name: UIResponder.keyboardWillHideNotification, object: nil)
    }
    
    @objc private func keyboardWillShow(_ notification: Notification) {
        guard let keyboardFrame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
        scrollView.contentInset.bottom = keyboardFrame.height
        scrollView.scrollIndicatorInsets.bottom = keyboardFrame.height
    }
    
    @objc private func keyboardWillHide(_ notification: Notification) {
        scrollView.contentInset.bottom = 0
        scrollView.scrollIndicatorInsets.bottom = 0
    }
}