import UIKit
import Combine

/// View controller responsible for displaying detailed information about a specific alert
/// with WCAG 2.1 Level AA accessibility and HIPAA compliance
final class AlertDetailViewController: UIViewController {
    
    // MARK: - Private Properties
    
    private let viewModel: AlertViewModel
    private let alert: Alert
    private let loadingView: LoadingView
    private var cancellables = Set<AnyCancellable>()
    
    private lazy var scrollView: UIScrollView = {
        let scrollView = UIScrollView()
        scrollView.isAccessibilityElement = false
        scrollView.showsVerticalScrollIndicator = true
        scrollView.alwaysBounceVertical = true
        return scrollView
    }()
    
    private lazy var contentStack: UIStackView = {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = AppConstants.UI_CONFIG.DEFAULT_PADDING
        stack.isLayoutMarginsRelativeArrangement = true
        stack.layoutMargins = UIEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        return stack
    }()
    
    private lazy var severityLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .headline)
        label.adjustsFontForContentSizeCategory = true
        label.numberOfLines = 0
        return label
    }()
    
    private lazy var timestampLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .subheadline)
        label.adjustsFontForContentSizeCategory = true
        label.textColor = .textSecondary
        label.numberOfLines = 0
        return label
    }()
    
    private lazy var messageLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .body)
        label.adjustsFontForContentSizeCategory = true
        label.numberOfLines = 0
        return label
    }()
    
    private lazy var metadataView: UIView = {
        let view = UIView()
        view.backgroundColor = .surface
        view.layer.cornerRadius = AppConstants.UI_CONFIG.CORNER_RADIUS
        view.layer.shadowColor = UIColor.shadow.cgColor
        view.layer.shadowOpacity = AppConstants.UI_CONFIG.SHADOW_OPACITY
        view.layer.shadowRadius = AppConstants.UI_CONFIG.SHADOW_RADIUS
        view.layer.shadowOffset = CGSize(width: 0, height: 2)
        return view
    }()
    
    private lazy var acknowledgeButton: UIButton = {
        let button = UIButton(type: .system)
        button.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        button.setTitle("Acknowledge Alert", for: .normal)
        button.backgroundColor = .primary
        button.setTitleColor(.surface, for: .normal)
        button.layer.cornerRadius = AppConstants.UI_CONFIG.CORNER_RADIUS
        button.heightAnchor.constraint(greaterThanOrEqualToConstant: AppConstants.UI_CONFIG.MINIMUM_TARGET_SIZE).isActive = true
        return button
    }()
    
    private var stateRestorationActivity: NSUserActivity?
    
    // MARK: - Initialization
    
    init(viewModel: AlertViewModel, alert: Alert) {
        self.viewModel = viewModel
        self.alert = alert
        self.loadingView = LoadingView(message: "Processing Alert")
        super.init(nibName: nil, bundle: nil)
        
        restorationIdentifier = "AlertDetailViewController"
        title = "Alert Details"
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle Methods
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        configureAccessibility()
        updateUI()
        setupBindings()
    }
    
    // MARK: - Private Methods
    
    private func setupUI() {
        view.backgroundColor = .background
        
        // Configure scroll view
        view.addSubview(scrollView)
        scrollView.anchor()
        scrollView.fillSuperview()
        
        // Configure content stack
        scrollView.addSubview(contentStack)
        contentStack.anchor()
        contentStack.widthAnchor.constraint(equalTo: scrollView.widthAnchor).isActive = true
        
        // Add components to stack
        contentStack.addArrangedSubview(severityLabel)
        contentStack.addArrangedSubview(timestampLabel)
        contentStack.addArrangedSubview(messageLabel)
        contentStack.addArrangedSubview(metadataView)
        contentStack.addArrangedSubview(acknowledgeButton)
        
        // Configure loading view
        view.addSubview(loadingView)
        loadingView.anchor()
        loadingView.fillSuperview()
        
        // Configure button action
        acknowledgeButton.addTarget(self, action: #selector(acknowledgeButtonTapped), for: .touchUpInside)
    }
    
    private func configureAccessibility() {
        // Configure scroll view accessibility
        scrollView.accessibilityLabel = "Alert details"
        
        // Configure severity label accessibility
        severityLabel.isAccessibilityElement = true
        severityLabel.accessibilityTraits = .staticText
        
        // Configure timestamp accessibility
        timestampLabel.isAccessibilityElement = true
        timestampLabel.accessibilityTraits = .staticText
        
        // Configure message accessibility
        messageLabel.isAccessibilityElement = true
        messageLabel.accessibilityTraits = .staticText
        
        // Configure button accessibility
        acknowledgeButton.isAccessibilityElement = true
        acknowledgeButton.accessibilityTraits = .button
        acknowledgeButton.accessibilityLabel = "Acknowledge alert"
    }
    
    private func setupBindings() {
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
        
        viewModel.$error
            .receive(on: DispatchQueue.main)
            .compactMap { $0 }
            .sink { [weak self] error in
                self?.showError(error)
            }
            .store(in: &cancellables)
    }
    
    private func updateUI() {
        // Update severity with semantic color
        let severityText = "Severity: \(alert.severity.description)"
        severityLabel.text = severityText
        severityLabel.textColor = getSeverityColor(alert.severity)
        
        // Update timestamp with locale-aware formatting
        let timestamp = DateFormatter.localizedString(from: alert.timestamp, dateStyle: .medium, timeStyle: .medium)
        timestampLabel.text = "Time: \(timestamp)"
        
        // Update message with secure content
        messageLabel.text = alert.message
        
        // Update metadata view with secure data
        configureMetadataView(with: alert.metadata)
        
        // Update button state
        acknowledgeButton.isEnabled = !alert.acknowledged
        acknowledgeButton.alpha = alert.acknowledged ? 0.5 : 1.0
        
        // Update accessibility labels
        updateAccessibilityLabels()
    }
    
    private func configureMetadataView(with metadata: [String: Any]) {
        // Implement secure metadata display with HIPAA compliance
        // This is a placeholder for the actual implementation
    }
    
    private func updateAccessibilityLabels() {
        severityLabel.accessibilityLabel = "Alert severity: \(alert.severity.description)"
        timestampLabel.accessibilityLabel = "Alert time: \(DateFormatter.localizedString(from: alert.timestamp, dateStyle: .long, timeStyle: .short))"
        messageLabel.accessibilityLabel = "Alert message: \(alert.message)"
        acknowledgeButton.accessibilityHint = alert.acknowledged ? "Alert has already been acknowledged" : "Double tap to acknowledge this alert"
    }
    
    private func getSeverityColor(_ severity: AlertSeverity) -> UIColor {
        switch severity {
        case .critical: return .error
        case .high: return .warning
        case .medium: return .accent
        case .low: return .success
        }
    }
    
    private func showError(_ error: Error) {
        let alert = UIAlertController(
            title: "Error",
            message: error.localizedDescription,
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
    
    // MARK: - Actions
    
    @objc private func acknowledgeButtonTapped() {
        loadingView.startAnimating()
        
        Task {
            await viewModel.acknowledgeAlert(id: alert.id)
            
            DispatchQueue.main.async { [weak self] in
                self?.loadingView.stopAnimating()
                self?.updateUI()
                
                // Post accessibility announcement
                UIAccessibility.post(
                    notification: .announcement,
                    argument: "Alert acknowledged successfully"
                )
                
                // Navigate back
                self?.navigationController?.popViewController(animated: true)
            }
        }
    }
}