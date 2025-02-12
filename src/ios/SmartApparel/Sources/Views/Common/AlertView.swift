import UIKit // latest

/// A Material Design 3.0 compliant alert view component for displaying system alerts,
/// warnings, and notifications with dynamic styling and accessibility support.
@IBDesignable
public class AlertView: UIView {
    
    // MARK: - UI Components
    
    private let titleLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 16, weight: .semibold)
        label.numberOfLines = 1
        label.adjustsFontForContentSizeCategory = true
        return label
    }()
    
    private let messageLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 14, weight: .regular)
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        return label
    }()
    
    private let iconImageView: UIImageView = {
        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFit
        imageView.tintAdjustmentMode = .automatic
        return imageView
    }()
    
    private let dismissButton: UIButton = {
        let button = UIButton(type: .system)
        button.setImage(UIImage(systemName: "xmark"), for: .normal)
        button.accessibilityLabel = "Dismiss alert"
        return button
    }()
    
    private let contentStack: UIStackView = {
        let stack = UIStackView()
        stack.axis = .horizontal
        stack.spacing = 12
        stack.alignment = .center
        stack.distribution = .fill
        return stack
    }()
    
    // MARK: - Properties
    
    private var alert: Alert?
    private var onDismiss: ((Alert) -> Void)?
    
    private let cornerRadius: CGFloat = 8.0
    private let shadowRadius: CGFloat = 4.0
    private let elevation: CGFloat = 2.0
    
    // MARK: - Initialization
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }
    
    // MARK: - Setup
    
    private func setupUI() {
        // Configure base view properties
        layer.cornerRadius = cornerRadius
        layer.masksToBounds = false
        layer.shadowRadius = shadowRadius
        layer.shadowOpacity = 0.1
        layer.shadowOffset = CGSize(width: 0, height: elevation)
        
        // Setup content stack
        addSubview(contentStack.anchor())
        contentStack.fillSuperview(padding: UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16))
        
        // Add components to stack
        contentStack.addArrangedSubview(iconImageView.anchor())
        iconImageView.constrainSize(CGSize(width: 24, height: 24))
        
        let textStack = UIStackView()
        textStack.axis = .vertical
        textStack.spacing = 4
        textStack.addArrangedSubview(titleLabel.anchor())
        textStack.addArrangedSubview(messageLabel.anchor())
        contentStack.addArrangedSubview(textStack.anchor())
        
        contentStack.addArrangedSubview(dismissButton.anchor())
        dismissButton.constrainSize(CGSize(width: 24, height: 24))
        
        // Setup interactions
        dismissButton.addTarget(self, action: #selector(handleDismiss), for: .touchUpInside)
        
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleDismiss))
        addGestureRecognizer(tapGesture)
        
        // Setup accessibility
        isAccessibilityElement = true
        accessibilityTraits = .alert
    }
    
    // MARK: - Configuration
    
    /// Configures the alert view with an alert model and optional dismiss callback
    /// - Parameters:
    ///   - alert: The alert model containing severity, type, and message
    ///   - onDismiss: Optional callback when alert is dismissed
    public func configure(with alert: Alert, onDismiss: ((Alert) -> Void)? = nil) {
        self.alert = alert
        self.onDismiss = onDismiss
        
        titleLabel.text = alert.type
        messageLabel.text = alert.message
        
        applyStyling(alert.severity)
        
        // Update accessibility
        accessibilityLabel = "\(alert.severity.description) alert: \(alert.type)"
        accessibilityHint = "Double tap to dismiss"
        accessibilityValue = alert.message
        
        UIAccessibility.post(notification: .announcement, argument: accessibilityLabel)
    }
    
    private func applyStyling(_ severity: AlertSeverity) {
        var backgroundColor: UIColor
        var iconName: String
        
        switch severity {
        case .critical:
            backgroundColor = .error.withAlphaComponent(0.15)
            iconName = "exclamationmark.triangle.fill"
            layer.shadowOpacity = 0.2
        case .high:
            backgroundColor = .error.withAlphaComponent(0.1)
            iconName = "exclamationmark.circle.fill"
            layer.shadowOpacity = 0.15
        case .medium:
            backgroundColor = .warning.withAlphaComponent(0.1)
            iconName = "exclamationmark.circle"
            layer.shadowOpacity = 0.1
        case .low:
            backgroundColor = .success.withAlphaComponent(0.1)
            iconName = "info.circle"
            layer.shadowOpacity = 0.1
        }
        
        self.backgroundColor = backgroundColor
        iconImageView.image = UIImage(systemName: iconName)
        iconImageView.tintColor = severity == .critical || severity == .high ? .error : .warning
        
        // Update text colors for contrast
        titleLabel.textColor = .text
        messageLabel.textColor = .textSecondary
        dismissButton.tintColor = .textSecondary
    }
    
    // MARK: - Actions
    
    @objc private func handleDismiss() {
        guard let alert = alert else { return }
        
        UIView.animate(withDuration: 0.3, animations: {
            self.alpha = 0
            self.transform = CGAffineTransform(scaleX: 0.9, y: 0.9)
        }) { _ in
            self.onDismiss?(alert)
            self.removeFromSuperview()
        }
        
        UIAccessibility.post(notification: .announcement, argument: "Alert dismissed")
    }
    
    // MARK: - Layout
    
    public override var intrinsicContentSize: CGSize {
        let stackSize = contentStack.systemLayoutSizeFitting(UIView.layoutFittingCompressedSize)
        return CGSize(width: UIView.noIntrinsicMetric, height: stackSize.height + 24)
    }
}